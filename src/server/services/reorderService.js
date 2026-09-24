import { connectDB } from "../db.js";
import { Order } from "../models/Order.js";
import { Cart } from "../models/Cart.js";
import { Brand } from "../models/Brand.js";
import { Product } from "../models/Product.js";
import { Errors } from "../http/errors.js";
import { assertObjectId, toId } from "../utils.js";
import { getCartView } from "./cartService.js";

const MAX_LINES = 200;

// ============================================================================
// REORDER — puts a past order's products back into the cart.
//
// It copies PRODUCTS and QUANTITIES only — never old prices. The cart is then
// priced fresh (current customer price, GST, availability) like any cart.
// Per product:
//   - deleted / inactive / brand hidden → skipped ("no longer available")
//   - out of stock                       → skipped
//   - less stock than wanted             → the available quantity is added
//   - below the (current) minimum qty    → raised to the minimum
//   - already in the cart                → quantities are added together
// The result tells the shop exactly what happened to each line.
// ============================================================================

export async function reorderToCart(auth, orderId) {
  await connectDB();
  assertObjectId(orderId, "Order");
  const { companyId, customerId } = auth;
  const settings = auth.company.settings ?? {};

  // Only the shop's own orders.
  const order = await Order.findOne({ _id: orderId, companyId, customerId }).select("orderNumber items").lean();
  if (!order) throw Errors.notFound("Order");

  const [cart, products, brands] = await Promise.all([
    Cart.findOne({ companyId, customerId }).lean(),
    Product.find({ companyId, _id: { $in: order.items.map((i) => i.productId) } })
      .select("name unit minOrderQty stockQuantity isActive archivedAt brandId")
      .lean(),
    Brand.find({ companyId, archivedAt: null, isActive: true }).select("_id").lean(),
  ]);
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const activeBrand = new Set(brands.map((b) => String(b._id)));
  const cartQty = new Map((cart?.items ?? []).map((i) => [String(i.productId), i.quantity]));

  const added = [];
  const skipped = [];

  for (const item of order.items) {
    const id = String(item.productId);
    const p = productById.get(id);
    const wanted = item.orderedQty;

    if (!p || p.archivedAt || !p.isActive || !activeBrand.has(String(p.brandId))) {
      skipped.push({ name: item.name, reason: "No longer available" });
      continue;
    }

    const moq = p.minOrderQty ?? 1;
    const inCart = cartQty.get(id) ?? 0;
    let target = Math.max(inCart + wanted, moq);
    let note = inCart > 0 ? `Added to the ${inCart} already in your cart` : "";
    if (target > inCart + wanted) note = `Raised to the minimum order of ${moq}`;

    if (!settings.allowNegativeStock) {
      if (p.stockQuantity <= 0 || p.stockQuantity < moq) {
        skipped.push({ name: p.name, reason: "Out of stock" });
        continue;
      }
      if (target > p.stockQuantity) {
        target = p.stockQuantity;
        note = `Only ${p.stockQuantity} ${p.unit} available`;
      }
    }

    if (target <= inCart) {
      skipped.push({ name: p.name, reason: `Already in your cart (${inCart} ${p.unit})` });
      continue;
    }
    cartQty.set(id, target);
    added.push({ productId: id, name: p.name, quantity: target - inCart, unit: p.unit, note });
  }

  if (cartQty.size > MAX_LINES) throw Errors.unprocessable(`Your cart can hold up to ${MAX_LINES} products.`, "CART_FULL");

  if (added.length) {
    // Keep existing lines in place; new ones are appended in the order's sequence.
    const existing = (cart?.items ?? []).map((i) => ({ ...i, quantity: cartQty.get(String(i.productId)) }));
    const existingIds = new Set(existing.map((i) => String(i.productId)));
    const appended = added
      .filter((a) => !existingIds.has(a.productId))
      .map((a) => ({ productId: a.productId, quantity: cartQty.get(a.productId), addedAt: new Date() }));
    await Cart.updateOne({ companyId, customerId }, { $set: { items: [...existing, ...appended] } }, { upsert: true });
  }

  const view = await getCartView(companyId, customerId, settings);

  // Tell the shop when today's price differs from what they paid last time.
  const oldPrice = new Map(order.items.map((i) => [String(i.productId), i.unitPrice]));
  for (const a of added) {
    const line = view.lines.find((l) => l.productId === a.productId);
    if (line?.available && oldPrice.get(a.productId) !== line.price) {
      a.priceChange = { from: oldPrice.get(a.productId), to: line.price };
    }
  }

  return { orderNumber: order.orderNumber, orderId: toId(order._id), added, skipped, view };
}

// Recent orders for the "Buy again" strip on the shop home page.
export async function recentOrdersForReorder(companyId, customerId, limit = 3) {
  await connectDB();
  const orders = await Order.find({ companyId, customerId, status: { $ne: "REJECTED" } })
    .select("orderNumber createdAt grandTotal status items.name items.orderedQty items.unit")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return orders.map((o) => ({
    id: toId(o._id),
    orderNumber: o.orderNumber,
    createdAt: o.createdAt?.toISOString() ?? null,
    grandTotal: o.grandTotal,
    status: o.status,
    itemCount: o.items.length,
    preview: o.items.slice(0, 3).map((i) => `${i.name} × ${i.orderedQty}`),
  }));
}
