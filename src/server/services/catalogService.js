import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Brand } from "../models/Brand.js";
import { Product } from "../models/Product.js";
import { Errors } from "../http/errors.js";
import { assertObjectId, pageMeta, tokenSearchFilter, toId } from "../utils.js";
import { resolvePrices } from "./pricingService.js";
import { stockStatus } from "../../lib/inventory.js";
import { splitGst } from "../../lib/tax.js";

// ============================================================================
// RETAILER-FACING catalog. What a shop may see:
//   - only ACTIVE products of ACTIVE brands of its own company
//   - only ITS OWN resolved price (never the default price, never other
//     shops' prices, never whether the price is "special")
//   - availability as in/low/out — never the exact stock number
// Everything here is keyed by the session's companyId + customerId.
// ============================================================================

const PRODUCT_FIELDS = "name sku brandId description imageUrl unit packSize mrp defaultPrice gstRate minOrderQty stockQuantity";

function toShopProductDTO(p, brandName, price, settings, { withDescription = false } = {}) {
  const { total } = splitGst(price, p.gstRate, settings.pricesIncludeGst);
  const dto = {
    id: toId(p._id),
    name: p.name,
    sku: p.sku,
    brand: { id: toId(p.brandId), name: brandName },
    imageUrl: p.imageUrl ?? "",
    unit: p.unit,
    packSize: p.packSize ?? null,
    minOrderQty: p.minOrderQty ?? 1,
    mrp: p.mrp ?? 0,
    price, // the shop's own price, paise
    priceInclGst: total,
    gstRate: p.gstRate,
    pricesIncludeGst: Boolean(settings.pricesIncludeGst),
    availability: stockStatus(p.stockQuantity ?? 0, settings.lowStockThreshold ?? 10),
    // Out-of-stock items can still be ordered if the distributor allows negative stock.
    orderable: (p.stockQuantity ?? 0) > 0 || Boolean(settings.allowNegativeStock),
  };
  if (withDescription) dto.description = p.description ?? "";
  return dto;
}

async function activeBrands(companyId) {
  const brands = await Brand.find({ companyId, archivedAt: null, isActive: true })
    .select("name slug logoUrl sortOrder")
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  return brands;
}

// Brands a shop can browse (active, with at least one orderable product).
export async function listShopBrands(companyId) {
  await connectDB();
  const [brands, counts] = await Promise.all([
    activeBrands(companyId),
    Product.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(String(companyId)), archivedAt: null, isActive: true } },
      { $group: { _id: "$brandId", count: { $sum: 1 } } },
    ]),
  ]);
  const countByBrand = new Map(counts.map((c) => [String(c._id), c.count]));
  return brands
    .map((b) => ({ id: toId(b._id), name: b.name, logoUrl: b.logoUrl ?? "", productCount: countByBrand.get(String(b._id)) ?? 0 }))
    .filter((b) => b.productCount > 0);
}

export async function listShopProducts(companyId, customerId, { q, brandId, page, limit }, settings = {}) {
  await connectDB();
  const brands = await activeBrands(companyId);
  const brandNames = new Map(brands.map((b) => [String(b._id), b.name]));

  // A requested brand that is hidden/deleted/foreign simply yields no results.
  const brandIds = brandId ? (brandNames.has(brandId) ? [brandId] : []) : brands.map((b) => b._id);

  const filter = {
    companyId,
    archivedAt: null,
    isActive: true,
    brandId: { $in: brandIds },
    ...tokenSearchFilter("searchText", q),
  };

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .select(PRODUCT_FIELDS)
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  // One batched price lookup for the whole page (not one query per product).
  const prices = await resolvePrices(companyId, customerId, products);

  return {
    items: products.map((p) => toShopProductDTO(p, brandNames.get(String(p.brandId)), prices.get(String(p._id)).price, settings)),
    meta: pageMeta(page, limit, total),
  };
}

// The raw product document IF this shop may order it (active product of an
// active brand of this company), otherwise 404. Used by the cart.
export async function getOrderableProductDoc(companyId, productId) {
  await connectDB();
  assertObjectId(productId, "Product");
  const product = await Product.findOne({ _id: productId, companyId, archivedAt: null, isActive: true }).select(PRODUCT_FIELDS).lean();
  if (!product) throw Errors.notFound("Product");
  const brandOk = await Brand.exists({ _id: product.brandId, companyId, archivedAt: null, isActive: true });
  if (!brandOk) throw Errors.notFound("Product");
  return product;
}

export async function getShopProduct(companyId, customerId, productId, settings = {}) {
  await connectDB();
  assertObjectId(productId, "Product");

  const product = await Product.findOne({ _id: productId, companyId, archivedAt: null, isActive: true }).select(PRODUCT_FIELDS).lean();
  if (!product) throw Errors.notFound("Product");

  const brand = await Brand.findOne({ _id: product.brandId, companyId, archivedAt: null, isActive: true }).select("name").lean();
  if (!brand) throw Errors.notFound("Product"); // product of a hidden brand is hidden too

  const prices = await resolvePrices(companyId, customerId, [product]);
  return toShopProductDTO(product, brand.name, prices.get(String(product._id)).price, settings, { withDescription: true });
}
