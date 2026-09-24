import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Customer } from "../models/Customer.js";
import { Company } from "../models/Company.js";
import { AppError, Errors } from "../http/errors.js";
import { assertObjectId } from "../utils.js";
import { ORDER_STATUS, ORDER_STATUS_LABELS, ORDER_TRANSITIONS, ROLES } from "../../lib/constants.js";
import { splitGst } from "../../lib/tax.js";
import { derivePaymentStatus } from "../../lib/payments.js";
import { addDays, todayIn } from "../../lib/dates.js";

// ============================================================================
// ORDER WORKFLOW — every status change goes through this file.
//
//   NEW ──confirm──▶ CONFIRMED ──▶ PACKED ──▶ DISPATCHED ──▶ DELIVERED
//    │                  │            │
//    ├──▶ REJECTED      └──▶ CANCELLED ◀┘        (stock is returned)
//    └──▶ CANCELLED  (also by the shop itself, while NEW)
//
// STOCK: deducted when the order is CONFIRMED (not when placed), returned if a
// confirmed order is cancelled. Both happen in the SAME transaction as the
// status change, so stock and order status can never disagree.
// Every change appends a timeline entry (who, when, note) — the audit trail.
// ============================================================================

function invalidTransition(from, to) {
  return new AppError(`This order is ${ORDER_STATUS_LABELS[from].toLowerCase()} and can't be marked ${ORDER_STATUS_LABELS[to].toLowerCase()}.`, {
    status: 409,
    code: "INVALID_TRANSITION",
  });
}

async function inTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    // withTransaction retries automatically if two admins act on the same
    // order at once; the retry re-reads the order and sees the new status.
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function timelineEntry(status, actor, note) {
  return { status, at: new Date(), byUserId: actor.userId, byName: actor.name, byRole: actor.role, note: note ?? "" };
}

// Recalculates a line and the order totals from the quantity being charged.
function recalcLine(item, qty, pricesIncludeGst) {
  const tax = splitGst(item.unitPrice * qty, item.gstRate, pricesIncludeGst);
  item.taxable = tax.taxable;
  item.gst = tax.gst;
  item.total = tax.total;
}

function recalcTotals(order) {
  order.subtotal = order.items.reduce((s, i) => s + i.taxable, 0);
  order.gstTotal = order.items.reduce((s, i) => s + i.gst, 0);
  order.grandTotal = order.items.reduce((s, i) => s + i.total, 0) - (order.discount ?? 0);
}

/**
 * Confirms a NEW order, optionally with changed quantities (partial
 * fulfilment), and deducts stock.
 * quantities: [{ itemId, confirmedQty }] — items not listed are confirmed in full.
 */
export async function confirmOrder(companyId, orderId, { quantities = [], note = "" }, actor, settings = {}) {
  await connectDB();
  assertObjectId(orderId, "Order");
  const requested = new Map(quantities.map((q) => [q.itemId, q.confirmedQty]));

  return inTransaction(async (session) => {
    const order = await Order.findOne({ _id: orderId, companyId }).session(session);
    if (!order) throw Errors.notFound("Order");
    if (order.status !== ORDER_STATUS.NEW) throw invalidTransition(order.status, ORDER_STATUS.CONFIRMED);

    const fieldErrors = {};
    for (const itemId of requested.keys()) {
      if (!order.items.id(itemId)) fieldErrors[itemId] = "Not part of this order.";
    }
    for (const item of order.items) {
      const qty = requested.has(String(item._id)) ? requested.get(String(item._id)) : item.orderedQty;
      if (qty > item.orderedQty) fieldErrors[String(item._id)] = `Can't confirm more than ordered (${item.orderedQty}).`;
      item.confirmedQty = qty;
    }
    if (Object.keys(fieldErrors).length) throw Errors.validation(fieldErrors, "Some quantities need fixing.");
    if (order.items.every((i) => i.confirmedQty === 0)) {
      throw Errors.unprocessable("All quantities are 0. Reject the order instead.", "NOTHING_TO_CONFIRM");
    }

    // Deduct stock. The "$gte" guard makes each deduction atomic and refuses
    // to go below zero (unless the company allows negative stock). If any line
    // fails, throwing aborts the transaction and ALL deductions roll back.
    const stockErrors = {};
    for (const item of order.items) {
      if (item.confirmedQty === 0) continue;
      const filter = { _id: item.productId, companyId };
      if (!settings.allowNegativeStock) filter.stockQuantity = { $gte: item.confirmedQty };
      const res = await Product.updateOne(filter, { $inc: { stockQuantity: -item.confirmedQty } }, { session });
      if (res.matchedCount === 0) {
        const p = await Product.findOne({ _id: item.productId, companyId }).select("stockQuantity").session(session).lean();
        stockErrors[String(item._id)] = p ? `Only ${p.stockQuantity} ${item.unit} in stock.` : "Product no longer exists — set to 0.";
      }
    }
    if (Object.keys(stockErrors).length) {
      throw Errors.unprocessable("Not enough stock for some items. Lower the quantities or add stock first.", "INSUFFICIENT_STOCK", stockErrors);
    }

    const changes = [];
    for (const item of order.items) {
      item.cancelledQty = item.orderedQty - item.confirmedQty;
      recalcLine(item, item.confirmedQty, order.pricesIncludeGst);
      if (item.cancelledQty > 0) changes.push(`${item.name}: ${item.orderedQty} → ${item.confirmedQty}`);
    }
    recalcTotals(order);
    // A lower total can change the payment status (e.g. an advance now covers it).
    order.paymentStatus = derivePaymentStatus(order.amountPaid ?? 0, order.grandTotal);

    const autoNote = changes.length ? `Confirmed with changes — ${changes.join("; ")}` : "";
    order.status = ORDER_STATUS.CONFIRMED;
    order.stockDeducted = true;
    order.timeline.push(timelineEntry(ORDER_STATUS.CONFIRMED, actor, [note, autoNote].filter(Boolean).join(" · ")));
    await order.save({ session });
    return order.toObject();
  });
}

/**
 * Any other status change: PACKED, DISPATCHED, DELIVERED, CANCELLED, REJECTED.
 * customerId: set when the SHOP acts (it may only cancel its own NEW orders).
 */
export async function transitionOrder(companyId, orderId, { status: to, note = "" }, actor, { customerId } = {}) {
  await connectDB();
  assertObjectId(orderId, "Order");
  if (to === ORDER_STATUS.CONFIRMED) throw Errors.badRequest("Use the confirm action to confirm an order.");

  return inTransaction(async (session) => {
    const order = await Order.findOne({ _id: orderId, companyId, ...(customerId && { customerId }) }).session(session);
    if (!order) throw Errors.notFound("Order");

    if (actor.role === ROLES.RETAILER && !(to === ORDER_STATUS.CANCELLED && order.status === ORDER_STATUS.NEW)) {
      throw new AppError(
        order.status === ORDER_STATUS.NEW ? "You can only cancel this order." : "This order is already being processed. Please contact the distributor to change it.",
        { status: 409, code: "INVALID_TRANSITION" },
      );
    }
    if (!ORDER_TRANSITIONS[order.status].includes(to)) throw invalidTransition(order.status, to);

    // Cancelling after confirmation puts the confirmed quantities back in stock.
    if (to === ORDER_STATUS.CANCELLED && order.stockDeducted) {
      for (const item of order.items) {
        if (item.confirmedQty > 0) {
          await Product.updateOne({ _id: item.productId, companyId }, { $inc: { stockQuantity: item.confirmedQty } }, { session });
        }
      }
      order.stockDeducted = false;
    }

    // Delivered → payment falls due after the shop's credit period.
    if (to === ORDER_STATUS.DELIVERED) {
      const [customer, company] = await Promise.all([
        Customer.findOne({ _id: order.customerId, companyId }).select("creditDays").session(session).lean(),
        Company.findById(companyId).select("settings").session(session).lean(),
      ]);
      const creditDays = customer?.creditDays ?? company?.settings?.defaultCreditDays ?? 0;
      order.creditDays = creditDays;
      order.dueOn = addDays(todayIn(company?.settings?.timezone ?? "Asia/Kolkata"), creditDays);
    }

    order.status = to;
    order.timeline.push(timelineEntry(to, actor, note));
    await order.save({ session });
    return order.toObject();
  });
}
