import { connectDB } from "../db.js";
import { Cart } from "../models/Cart.js";
import { Brand } from "../models/Brand.js";
import { Product } from "../models/Product.js";
import { Errors } from "../http/errors.js";
import { assertObjectId, toId } from "../utils.js";
import { resolvePrices } from "./pricingService.js";
import { getOrderableProductDoc } from "./catalogService.js";
import { stockStatus } from "../../lib/inventory.js";
import { splitGst } from "../../lib/tax.js";

const MAX_LINES = 200;

// ============================================================================
// priceItems() — turns [{ productId, quantity }] into fully priced, validated
// lines using ONLY server data: current product records, this shop's resolved
// prices (pricingService) and GST rules (lib/tax). The cart page shows its
// result, and order creation (next phase) uses the SAME function, so what the
// shop sees in the cart is exactly what the order will charge.
// ============================================================================

const ISSUE = {
  UNAVAILABLE: "UNAVAILABLE",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  BELOW_MIN_QTY: "BELOW_MIN_QTY",
};

const PRODUCT_FIELDS = "name sku brandId imageUrl unit packSize mrp defaultPrice gstRate minOrderQty stockQuantity isActive archivedAt";

export async function priceItems(companyId, customerId, items, settings = {}) {
  await connectDB();
  const allowNegativeStock = Boolean(settings.allowNegativeStock);
  const ids = items.map((i) => i.productId);

  const [products, brands] = await Promise.all([
    ids.length ? Product.find({ companyId, _id: { $in: ids } }).select(PRODUCT_FIELDS).lean() : [],
    Brand.find({ companyId, archivedAt: null, isActive: true }).select("name").lean(),
  ]);
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const brandName = new Map(brands.map((b) => [String(b._id), b.name]));
  const isOrderable = (p) => p && p.isActive && !p.archivedAt && brandName.has(String(p.brandId));

  const prices = await resolvePrices(companyId, customerId, products.filter(isOrderable));

  const lines = items.map((item) => {
    const productId = String(item.productId);
    const p = productById.get(productId);
    const quantity = item.quantity;

    if (!isOrderable(p)) {
      return {
        productId,
        quantity,
        name: p?.name ?? "Product no longer available",
        sku: p?.sku ?? "",
        brandName: p ? (brandName.get(String(p.brandId)) ?? "") : "",
        imageUrl: p?.imageUrl ?? "",
        unit: p?.unit ?? "",
        available: false,
        issues: [{ code: ISSUE.UNAVAILABLE, message: "No longer available. Please remove it." }],
        price: 0, gstRate: 0, taxable: 0, gst: 0, total: 0,
      };
    }

    const price = prices.get(productId).price;
    const tax = splitGst(price * quantity, p.gstRate, settings.pricesIncludeGst);
    const issues = [];
    if (quantity < (p.minOrderQty ?? 1)) {
      issues.push({ code: ISSUE.BELOW_MIN_QTY, message: `Minimum order is ${p.minOrderQty} ${p.unit}.` });
    }
    if (!allowNegativeStock) {
      if (p.stockQuantity <= 0) issues.push({ code: ISSUE.OUT_OF_STOCK, message: "Out of stock. Please remove it." });
      else if (quantity > p.stockQuantity) {
        issues.push({ code: ISSUE.INSUFFICIENT_STOCK, message: `Only ${p.stockQuantity} ${p.unit} available.` });
      }
    }

    return {
      productId,
      quantity,
      name: p.name,
      sku: p.sku,
      brandName: brandName.get(String(p.brandId)),
      imageUrl: p.imageUrl ?? "",
      unit: p.unit,
      packSize: p.packSize ?? null,
      mrp: p.mrp ?? 0,
      minOrderQty: p.minOrderQty ?? 1,
      availability: stockStatus(p.stockQuantity, settings.lowStockThreshold ?? 10),
      available: true,
      issues,
      price, // per unit, paise
      gstRate: p.gstRate,
      taxable: tax.taxable, // line amounts, paise
      gst: tax.gst,
      total: tax.total,
    };
  });

  const counted = lines.filter((l) => l.available);
  const totals = {
    lineCount: lines.length,
    unitCount: counted.reduce((s, l) => s + l.quantity, 0),
    subtotal: counted.reduce((s, l) => s + l.taxable, 0),
    gst: counted.reduce((s, l) => s + l.gst, 0),
    total: counted.reduce((s, l) => s + l.total, 0),
  };

  return {
    lines,
    totals,
    canCheckout: lines.length > 0 && lines.every((l) => l.issues.length === 0),
    pricesIncludeGst: Boolean(settings.pricesIncludeGst),
  };
}

// ---------------------------------------------------------------------------

export async function getCartView(companyId, customerId, settings) {
  await connectDB();
  const cart = await Cart.findOne({ companyId, customerId }).lean();
  // Lines keep the order they were added in, so they don't jump around while editing.
  return priceItems(companyId, customerId, cart?.items ?? [], settings);
}

// Cheap query for the header badge and product-card steppers.
export async function getCartQuantities(companyId, customerId) {
  await connectDB();
  const cart = await Cart.findOne({ companyId, customerId }).select("items.productId items.quantity").lean();
  return (cart?.items ?? []).map((i) => ({ productId: toId(i.productId), quantity: i.quantity }));
}

// SETS the quantity (not "adds"). A retried request on a flaky mobile
// connection therefore can't double the quantity. quantity 0 = remove.
export async function setCartItem(companyId, customerId, productId, quantity, settings = {}) {
  await connectDB();
  if (quantity === 0) return removeCartItem(companyId, customerId, productId, settings);

  const product = await getOrderableProductDoc(companyId, productId);
  const moq = product.minOrderQty ?? 1;
  if (quantity < moq) {
    throw Errors.unprocessable(`Minimum order is ${moq} ${product.unit}.`, ISSUE.BELOW_MIN_QTY, { quantity: `At least ${moq}.` });
  }
  if (!settings.allowNegativeStock) {
    if (product.stockQuantity <= 0) throw Errors.unprocessable(`${product.name} is out of stock.`, ISSUE.OUT_OF_STOCK);
    if (quantity > product.stockQuantity) {
      throw Errors.unprocessable(`Only ${product.stockQuantity} ${product.unit} of ${product.name} available.`, ISSUE.INSUFFICIENT_STOCK, {
        quantity: `Only ${product.stockQuantity} available.`,
      });
    }
  }

  await upsertLine(companyId, customerId, product._id, quantity);
  return getCartView(companyId, customerId, settings);
}

// Atomic update: change the line if present, otherwise push a new line
// (creating the cart if needed). No read-modify-write race.
async function upsertLine(companyId, customerId, productId, quantity, retried = false) {
  const updated = await Cart.updateOne(
    { companyId, customerId, "items.productId": productId },
    { $set: { "items.$.quantity": quantity } },
  );
  if (updated.matchedCount > 0) return;

  const cart = await Cart.findOne({ companyId, customerId }).select("items.productId").lean();
  if ((cart?.items.length ?? 0) >= MAX_LINES) {
    throw Errors.unprocessable(`Your cart can hold up to ${MAX_LINES} products. Please place an order first.`, "CART_FULL");
  }

  try {
    await Cart.updateOne(
      { companyId, customerId, "items.productId": { $ne: productId } },
      { $push: { items: { productId, quantity, addedAt: new Date() } } },
      { upsert: true },
    );
  } catch (err) {
    // Two requests created the cart at the same moment → the unique index
    // rejected one. The cart exists now, so just try again once.
    if (err?.code === 11000 && !retried) return upsertLine(companyId, customerId, productId, quantity, true);
    throw err;
  }
}

export async function removeCartItem(companyId, customerId, productId, settings = {}) {
  await connectDB();
  assertObjectId(productId, "Product");
  await Cart.updateOne({ companyId, customerId }, { $pull: { items: { productId } } });
  return getCartView(companyId, customerId, settings);
}

// Empties the cart. Accepts a transaction session so order creation can
// clear the cart in the same transaction that creates the order.
export async function clearCart(companyId, customerId, { session = null } = {}) {
  await connectDB();
  await Cart.updateOne({ companyId, customerId }, { $set: { items: [] } }, { session });
}
