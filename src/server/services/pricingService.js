import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { CustomerPrice } from "../models/CustomerPrice.js";
import { Product } from "../models/Product.js";
import { Errors } from "../http/errors.js";
import { assertObjectId, toId, toIso } from "../utils.js";
import { requireCustomer } from "./customerService.js";
import { listProducts } from "./productService.js";
import { startOfDay, todayIn, addDays } from "../../lib/dates.js";
import { formatINR } from "../../lib/money.js";

// ============================================================================
// PRICING RULE — the ONE place that decides what a shop pays.
//
//   1. Customer-specific price: an active CustomerPrice for (shop, product)
//      whose period contains "now". If several overlap, the one that started
//      most recently wins.
//   2. Otherwise: the product's defaultPrice.
//
// Prices are before GST. Retailer listing, cart, checkout, order creation and
// reorder MUST all call resolvePrices() — never read prices any other way.
// ============================================================================

const isOpenAt = (at) => ({ $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }] });

// records must be sorted by effectiveFrom DESC.
function pickApplicable(records, at) {
  return records.find((r) => r.effectiveFrom <= at && (!r.effectiveTo || r.effectiveTo > at)) ?? null;
}

// The next scheduled (future) price, if any — shown to the admin.
function pickUpcoming(records, at) {
  const future = records.filter((r) => r.effectiveFrom > at);
  return future.length ? future[future.length - 1] : null; // earliest future one
}

async function loadOpenRecords(companyId, customerId, productIds, at) {
  return CustomerPrice.find({
    companyId,
    customerId,
    productId: { $in: productIds },
    isActive: true,
    ...isOpenAt(at),
  })
    .sort({ effectiveFrom: -1 })
    .lean();
}

function groupByProduct(records) {
  const map = new Map();
  for (const r of records) {
    const key = String(r.productId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

/**
 * Resolves the price a customer pays for each product.
 * @param products  already-loaded products of THIS company: [{ _id, defaultPrice }]
 * @returns Map productId → { price, source: "CUSTOMER" | "DEFAULT", customerPriceId }
 */
export async function resolvePrices(companyId, customerId, products, at = new Date()) {
  await connectDB();
  const records = products.length ? await loadOpenRecords(companyId, customerId, products.map((p) => p._id), at) : [];
  const byProduct = groupByProduct(records);

  const result = new Map();
  for (const p of products) {
    const special = pickApplicable(byProduct.get(String(p._id)) ?? [], at);
    result.set(
      String(p._id),
      special
        ? { price: special.price, source: "CUSTOMER", customerPriceId: toId(special._id) }
        : { price: p.defaultPrice, source: "DEFAULT", customerPriceId: null },
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Admin: pricing grid for one customer
// ---------------------------------------------------------------------------

const priceDTO = (r) =>
  r ? { id: toId(r._id), price: r.price, effectiveFrom: toIso(r.effectiveFrom), effectiveTo: toIso(r.effectiveTo) } : null;

export async function listCustomerPriceRows(companyId, customerId, { q, brandId, view, page, limit }) {
  await connectDB();
  await requireCustomer(companyId, customerId);
  const now = new Date();

  let productIds;
  if (view === "special") {
    productIds = await CustomerPrice.distinct("productId", { companyId, customerId, isActive: true, ...isOpenAt(now) });
  }

  const { items, meta } = await listProducts(companyId, { q, brandId, status: "all", page, limit, productIds });
  const records = items.length ? await loadOpenRecords(companyId, customerId, items.map((p) => p.id), now) : [];
  const byProduct = groupByProduct(records);

  const rows = items.map((product) => {
    const recs = byProduct.get(product.id) ?? [];
    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        brandName: product.brand.name,
        unit: product.unit,
        mrp: product.mrp,
        defaultPrice: product.defaultPrice,
        isActive: product.isActive,
      },
      current: priceDTO(pickApplicable(recs, now)),
      upcoming: priceDTO(pickUpcoming(recs, now)),
    };
  });

  return { rows, meta };
}

export async function countSpecialPrices(companyId, customerId) {
  await connectDB();
  const ids = await CustomerPrice.distinct("productId", { companyId, customerId, isActive: true, ...isOpenAt(new Date()) });
  return ids.length;
}

/**
 * Sets special prices for many products at once.
 * effectiveFrom/effectiveTo are "YYYY-MM-DD" dates in the company's timezone:
 *   - effectiveFrom empty or today → effective immediately
 *   - effectiveTo is the LAST day the price applies (inclusive)
 */
export async function setCustomerPrices(companyId, customerId, { prices, effectiveFrom, effectiveTo }, { userId, timeZone }) {
  await connectDB();
  await requireCustomer(companyId, customerId);

  const now = new Date();
  const today = todayIn(timeZone, now);
  const fromDate = effectiveFrom || today;
  if (fromDate < today) throw Errors.validation({ effectiveFrom: "Start date can't be in the past." });

  const from = fromDate === today ? now : startOfDay(fromDate, timeZone);
  const to = effectiveTo ? startOfDay(addDays(effectiveTo, 1), timeZone) : null;
  if (to && to <= from) throw Errors.validation({ effectiveTo: "End date must be on or after the start date." });

  // Last entry wins if the same product appears twice.
  const entries = [...new Map(prices.map((p) => [p.productId, p])).values()];
  const productIds = entries.map((e) => e.productId);

  // Every product must belong to THIS company (and not be deleted).
  const products = await Product.find({ companyId, _id: { $in: productIds }, archivedAt: null }).select("mrp").lean();
  const mrpById = new Map(products.map((p) => [String(p._id), p.mrp]));

  const fieldErrors = {};
  for (const e of entries) {
    if (!mrpById.has(e.productId)) fieldErrors[e.productId] = "Product not found.";
    else if (mrpById.get(e.productId) > 0 && e.price > mrpById.get(e.productId)) {
      fieldErrors[e.productId] = `Can't be more than MRP (${formatINR(mrpById.get(e.productId))}).`;
    }
  }
  if (Object.keys(fieldErrors).length) throw Errors.validation(fieldErrors, "Some prices need fixing.");

  // Transaction: closing the old prices and inserting the new ones happen
  // together or not at all.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (from === now) {
        // A price that starts now ends the currently running one, so history
        // reads cleanly: "₹650 from 1 Sep to 23 Sep, ₹630 from 23 Sep".
        await CustomerPrice.updateMany(
          { companyId, customerId, productId: { $in: productIds }, isActive: true, effectiveFrom: { $lte: now }, ...isOpenAt(now) },
          { $set: { effectiveTo: now, updatedBy: userId } },
          { session },
        );
      }
      await CustomerPrice.insertMany(
        entries.map((e) => ({
          companyId,
          customerId,
          productId: e.productId,
          price: e.price,
          effectiveFrom: from,
          effectiveTo: to,
          createdBy: userId,
          updatedBy: userId,
        })),
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return { saved: entries.length, effectiveFrom: toIso(from), effectiveTo: toIso(to) };
}

// Removes the special price (current AND scheduled) → default price applies again.
// Records are ended/deactivated, not deleted, to keep the history.
export async function removeCustomerPrice(companyId, customerId, productId, { userId }) {
  await connectDB();
  await requireCustomer(companyId, customerId);
  assertObjectId(productId, "Product");
  const now = new Date();

  const base = { companyId, customerId, productId, isActive: true, ...isOpenAt(now) };
  const [ended, cancelled] = await Promise.all([
    CustomerPrice.updateMany({ ...base, effectiveFrom: { $lte: now } }, { $set: { effectiveTo: now, updatedBy: userId } }),
    CustomerPrice.updateMany({ ...base, effectiveFrom: { $gt: now } }, { $set: { isActive: false, updatedBy: userId } }),
  ]);

  if (ended.modifiedCount + cancelled.modifiedCount === 0) throw Errors.notFound("Special price");
  return { removed: true };
}
