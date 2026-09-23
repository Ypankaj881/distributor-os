import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Order } from "../models/Order.js";
import { Cart } from "../models/Cart.js";
import { nextSequence } from "../models/Counter.js";
import { AppError, Errors } from "../http/errors.js";
import { assertObjectId, pageMeta, toId, toIso } from "../utils.js";
import { requireCustomer } from "./customerService.js";
import { priceItems, clearCart } from "./cartService.js";
import { ORDER_STATUS, ROLES } from "../../lib/constants.js";

const ORDER_NUMBER_OFFSET = 1000; // first order is CH-1001, not CH-1

// ============================================================================
// createOrder() — the ONE way an order comes into existence.
// Today it is called from the shop's cart (placeOrderFromCart). Later an
// admin "order on behalf of a shop" screen, or a WhatsApp parser, can call it
// with a plain list of items. Every caller gets the same rules:
//   - prices, GST and totals recalculated on the server (priceItems)
//   - every line must be orderable (active, in stock, ≥ minimum qty)
//   - product/price/customer/address snapshots stored on the order
//   - order number + first timeline entry, in one transaction
// ============================================================================

function addressSnapshot(address) {
  if (!address) return null;
  const { label, line1, line2, landmark, city, state, pincode } = address;
  return { label, line1, line2, landmark, city, state, pincode };
}

export async function createOrder({
  companyId,
  customerId,
  items,
  settings,
  actor, // { userId, name, role }
  source = "PORTAL",
  addressId,
  notes = "",
  idempotencyKey,
  expectedTotal,
  clearCartAfter = false,
}) {
  await connectDB();

  // Duplicate submit (double tap, network retry): return the existing order.
  if (idempotencyKey) {
    const existing = await Order.findOne({ companyId, customerId, idempotencyKey }).lean();
    if (existing) return { order: existing, duplicate: true };
  }

  const customer = await requireCustomer(companyId, customerId);
  if (!customer.isActive) throw Errors.forbidden("This account is inactive. Please contact the distributor.");

  if (!items.length) throw Errors.unprocessable("Your cart is empty.", "CART_EMPTY");

  // Delivery address: the chosen one, or the shop's default.
  let address = null;
  if (addressId) {
    address = customer.shippingAddresses.id(addressId);
    if (!address) throw Errors.validation({ addressId: "Choose a delivery address." });
  } else {
    address = customer.shippingAddresses.find((a) => a.isDefault) ?? customer.shippingAddresses[0] ?? null;
  }

  // Server-side pricing and validation. Nothing from the browser is used
  // except product ids and quantities.
  const priced = await priceItems(companyId, customerId, items, settings);
  if (!priced.canCheckout) {
    throw Errors.unprocessable("Some items in your cart need attention.", "CART_HAS_ISSUES");
  }
  if (expectedTotal != null && expectedTotal !== priced.totals.total) {
    throw new AppError("Prices or availability changed since you opened checkout. Please review your order.", {
      status: 409,
      code: "PRICE_CHANGED",
    });
  }

  const now = new Date();
  const doc = {
    companyId,
    customerId: customer._id,
    source,
    placedBy: actor.userId,
    ...(idempotencyKey && { idempotencyKey }),
    customerSnapshot: {
      shopName: customer.shopName,
      ownerName: customer.ownerName ?? "",
      phone: customer.phone,
      customerCode: customer.customerCode,
      gstin: customer.gstin ?? "",
    },
    shippingAddress: addressSnapshot(address),
    items: priced.lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      sku: l.sku,
      brandName: l.brandName ?? "",
      unit: l.unit,
      packSize: l.packSize ?? null,
      gstRate: l.gstRate,
      unitPrice: l.price,
      orderedQty: l.quantity,
      taxable: l.taxable,
      gst: l.gst,
      total: l.total,
    })),
    pricesIncludeGst: priced.pricesIncludeGst,
    subtotal: priced.totals.subtotal,
    discount: 0,
    gstTotal: priced.totals.gst,
    grandTotal: priced.totals.total,
    notes,
    status: ORDER_STATUS.NEW,
    timeline: [{ status: ORDER_STATUS.NEW, at: now, byUserId: actor.userId, byName: actor.name, byRole: actor.role, note: "Order placed" }],
  };

  // Order number + order + (optionally) emptying the cart: all or nothing.
  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      const prefix = settings?.orderPrefix || "ORD";
      const seq = await nextSequence(companyId, "order", { session });
      doc.orderNumber = `${prefix}-${seq + ORDER_NUMBER_OFFSET}`;
      [created] = await Order.create([doc], { session });
      if (clearCartAfter) await clearCart(companyId, customerId, { session });
    });
    return { order: created.toObject(), duplicate: false };
  } catch (err) {
    // Two identical submits raced past the first check: the unique index let
    // only one through. Return that one.
    if (err?.code === 11000 && idempotencyKey && err.keyPattern?.idempotencyKey) {
      const existing = await Order.findOne({ companyId, customerId, idempotencyKey }).lean();
      if (existing) return { order: existing, duplicate: true };
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

// The shop's checkout: order whatever is in its cart, then empty the cart.
export async function placeOrderFromCart(auth, { idempotencyKey, addressId, notes, expectedTotal }) {
  await connectDB();
  const cart = await Cart.findOne({ companyId: auth.companyId, customerId: auth.customerId }).lean();
  const items = (cart?.items ?? []).map((i) => ({ productId: i.productId, quantity: i.quantity }));

  // A retry after success finds an empty cart — check the key first so the
  // shop gets its order back instead of "cart is empty".
  if (!items.length && idempotencyKey) {
    const existing = await Order.findOne({ companyId: auth.companyId, customerId: auth.customerId, idempotencyKey }).lean();
    if (existing) return { order: toShopOrderDTO(existing), duplicate: true };
  }

  const { order, duplicate } = await createOrder({
    companyId: auth.companyId,
    customerId: auth.customerId,
    items,
    settings: auth.company.settings,
    actor: { userId: auth.userId, name: auth.name, role: auth.role },
    source: "PORTAL",
    addressId,
    notes,
    idempotencyKey,
    expectedTotal,
    clearCartAfter: true,
  });
  return { order: toShopOrderDTO(order), duplicate };
}

// ---------------------------------------------------------------------------
// Retailer views
// ---------------------------------------------------------------------------

// What the SHOP may see about its order. Staff names and internal ids are
// left out of the timeline.
export function toShopOrderDTO(o) {
  return {
    id: toId(o._id),
    orderNumber: o.orderNumber,
    shopName: o.customerSnapshot?.shopName ?? "",
    status: o.status,
    paymentStatus: o.paymentStatus,
    createdAt: toIso(o.createdAt),
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
    })),
    pricesIncludeGst: o.pricesIncludeGst,
    subtotal: o.subtotal,
    discount: o.discount ?? 0,
    gstTotal: o.gstTotal,
    grandTotal: o.grandTotal,
    shippingAddress: o.shippingAddress ?? null,
    notes: o.notes ?? "",
    timeline: (o.timeline ?? []).map((t) => ({
      status: t.status,
      at: toIso(t.at),
      by: t.byRole === ROLES.RETAILER ? "You" : "Distributor",
      note: t.note ?? "",
    })),
  };
}

export async function listShopOrders(companyId, customerId, { page, limit }) {
  await connectDB();
  const filter = { companyId, customerId };
  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .select("orderNumber status grandTotal createdAt items.name items.orderedQty")
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
      grandTotal: o.grandTotal,
      createdAt: toIso(o.createdAt),
      itemCount: o.items.length,
      preview: o.items.slice(0, 3).map((i) => i.name),
    })),
    meta: pageMeta(page, limit, total),
  };
}

export async function getShopOrder(companyId, customerId, orderId) {
  await connectDB();
  assertObjectId(orderId, "Order");
  // customerId in the filter: a shop can only open ITS OWN orders.
  const order = await Order.findOne({ _id: orderId, companyId, customerId }).lean();
  if (!order) throw Errors.notFound("Order");
  return toShopOrderDTO(order);
}
