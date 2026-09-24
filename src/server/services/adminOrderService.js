import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Errors } from "../http/errors.js";
import { assertObjectId, escapeRegex, pageMeta, toId, toIso } from "../utils.js";
import { ORDER_STATUS, ORDER_TRANSITIONS } from "../../lib/constants.js";
import { startOfDay, addDays, todayIn } from "../../lib/dates.js";

// Admin (distributor) views of orders. Every query is scoped by companyId.

const CLOSED = [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED];

const BILLABLE = [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PACKED, ORDER_STATUS.DISPATCHED, ORDER_STATUS.DELIVERED];

function listFilter(companyId, { status, q, customerId, from, to, payment }, timeZone) {
  const filter = { companyId };
  // Payment filters (combined with the status tab via $and below).
  const pay = {
    unpaid: { paymentStatus: "UNPAID", status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED] } },
    partial: { paymentStatus: "PARTIAL", status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED] } },
    paid: { paymentStatus: "PAID" },
    due: { paymentStatus: { $ne: "PAID" }, status: { $in: BILLABLE } },
    overdue: { paymentStatus: { $ne: "PAID" }, status: { $in: BILLABLE }, dueOn: { $ne: null, $lt: todayIn(timeZone) } },
  }[payment];
  if (pay) filter.$and = [pay];
  if (status === "open") filter.status = { $nin: CLOSED };
  else if (status === "closed") filter.status = { $in: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED] };
  else if (status && status !== "all") filter.status = status;
  if (customerId) filter.customerId = customerId;
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: "i" };
    filter.$or = [{ orderNumber: rx }, { "customerSnapshot.shopName": rx }, { "customerSnapshot.phone": rx }];
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = startOfDay(from, timeZone);
    if (to) filter.createdAt.$lt = startOfDay(addDays(to, 1), timeZone);
  }
  return filter;
}

export async function listAdminOrders(companyId, query, { timeZone = "Asia/Kolkata" } = {}) {
  await connectDB();
  const { page, limit } = query;
  const filter = listFilter(companyId, query, timeZone);

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .select("orderNumber status paymentStatus amountPaid dueOn grandTotal createdAt customerId customerSnapshot.shopName customerSnapshot.customerCode items.orderedQty source")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    items: orders.map((o) => ({
      id: toId(o._id),
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      amountPaid: o.amountPaid ?? 0,
      dueOn: o.dueOn ?? null,
      grandTotal: o.grandTotal,
      createdAt: toIso(o.createdAt),
      customerId: toId(o.customerId),
      shopName: o.customerSnapshot?.shopName ?? "",
      customerCode: o.customerSnapshot?.customerCode ?? "",
      itemCount: o.items.length,
      source: o.source,
    })),
    meta: pageMeta(page, limit, total),
  };
}

// Number of orders per status, for the tabs ("New (4)").
export async function countOrdersByStatus(companyId) {
  await connectDB();
  const rows = await Order.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(String(companyId)) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(Object.values(ORDER_STATUS).map((s) => [s, 0]));
  for (const r of rows) counts[r._id] = r.count;
  counts.all = rows.reduce((s, r) => s + r.count, 0);
  counts.open = counts.all - CLOSED.reduce((s, st) => s + counts[st], 0);
  return counts;
}

export function toAdminOrderDTO(o, stockByProduct = new Map()) {
  return {
    id: toId(o._id),
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    amountPaid: o.amountPaid ?? 0,
    dueOn: o.dueOn ?? null,
    creditDays: o.creditDays ?? null,
    payments: (o.payments ?? []).map((p) => ({
      id: toId(p._id),
      amount: p.amount,
      mode: p.mode,
      paidOn: p.paidOn,
      reference: p.reference ?? "",
      note: p.note ?? "",
      recordedAt: toIso(p.recordedAt),
      recordedByName: p.recordedByName ?? "",
      voided: Boolean(p.voidedAt),
      voidedByName: p.voidedByName ?? "",
      voidReason: p.voidReason ?? "",
    })),
    source: o.source,
    stockDeducted: Boolean(o.stockDeducted),
    createdAt: toIso(o.createdAt),
    customer: {
      id: toId(o.customerId),
      shopName: o.customerSnapshot?.shopName ?? "",
      ownerName: o.customerSnapshot?.ownerName ?? "",
      phone: o.customerSnapshot?.phone ?? "",
      customerCode: o.customerSnapshot?.customerCode ?? "",
      gstin: o.customerSnapshot?.gstin ?? "",
    },
    shippingAddress: o.shippingAddress ?? null,
    notes: o.notes ?? "",
    items: o.items.map((i) => ({
      id: toId(i._id),
      productId: toId(i.productId),
      name: i.name,
      sku: i.sku,
      brandName: i.brandName,
      unit: i.unit,
      packSize: i.packSize ?? null,
      gstRate: i.gstRate,
      unitPrice: i.unitPrice,
      orderedQty: i.orderedQty,
      confirmedQty: i.confirmedQty ?? null,
      cancelledQty: i.cancelledQty ?? 0,
      taxable: i.taxable,
      gst: i.gst,
      total: i.total,
      // Current stock — only looked up for NEW orders, to help confirmation.
      currentStock: stockByProduct.has(String(i.productId)) ? stockByProduct.get(String(i.productId)) : null,
    })),
    pricesIncludeGst: o.pricesIncludeGst,
    subtotal: o.subtotal,
    discount: o.discount ?? 0,
    gstTotal: o.gstTotal,
    grandTotal: o.grandTotal,
    timeline: (o.timeline ?? []).map((t) => ({ status: t.status, at: toIso(t.at), by: t.byName || "", byRole: t.byRole ?? null, note: t.note ?? "" })),
    nextStatuses: ORDER_TRANSITIONS[o.status] ?? [],
  };
}

export async function getAdminOrder(companyId, orderId) {
  await connectDB();
  assertObjectId(orderId, "Order");
  const order = await Order.findOne({ _id: orderId, companyId }).lean();
  if (!order) throw Errors.notFound("Order");

  let stock = new Map();
  if (order.status === ORDER_STATUS.NEW) {
    const products = await Product.find({ companyId, _id: { $in: order.items.map((i) => i.productId) } }).select("stockQuantity").lean();
    stock = new Map(products.map((p) => [String(p._id), p.stockQuantity]));
  }
  return toAdminOrderDTO(order, stock);
}

export async function recentOrdersForCustomer(companyId, customerId, limit = 5) {
  const { items, meta } = await listAdminOrders(companyId, { customerId, page: 1, limit, status: "all" });
  return { items, total: meta.total };
}

// Small, cheap summary for the admin's live "new orders" alert (polled every ~30 s).
export async function getNewOrdersSummary(companyId) {
  await connectDB();
  const [newCount, latest] = await Promise.all([
    Order.countDocuments({ companyId, status: ORDER_STATUS.NEW }),
    Order.find({ companyId, status: ORDER_STATUS.NEW })
      .select("orderNumber customerSnapshot.shopName grandTotal createdAt")
      .sort({ createdAt: -1 })
      .limit(1)
      .lean(),
  ]);
  const o = latest[0];
  return {
    newCount,
    latest: o ? { id: toId(o._id), orderNumber: o.orderNumber, shopName: o.customerSnapshot?.shopName ?? "", grandTotal: o.grandTotal, createdAt: toIso(o.createdAt) } : null,
  };
}
