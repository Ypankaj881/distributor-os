import { connectDB } from "../db.js";
import { Product } from "../models/Product.js";
import { Errors } from "../http/errors.js";
import { assertObjectId, pageMeta, tokenSearchFilter, toId, toIso } from "../utils.js";
import { requireBrand } from "./brandService.js";
import { buildProductSearchText } from "./productSearch.js";
import { formatINR } from "../../lib/money.js";

// Admin-facing product logic. Every query is scoped by companyId, and archived
// (soft-deleted) products are excluded everywhere.

// Full product details for the ADMIN. The retailer never receives this shape:
// the shop APIs (Phase 5) use their own DTO with only the retailer's price.
function toAdminProductDTO(p) {
  const brandPopulated = p.brandId && typeof p.brandId === "object" && "name" in p.brandId;
  return {
    id: toId(p._id),
    brand: brandPopulated ? { id: toId(p.brandId._id), name: p.brandId.name } : { id: toId(p.brandId), name: null },
    name: p.name,
    sku: p.sku,
    description: p.description ?? "",
    imageUrl: p.imageUrl ?? "",
    unit: p.unit,
    packSize: p.packSize ?? null,
    mrp: p.mrp ?? 0,
    defaultPrice: p.defaultPrice,
    gstRate: p.gstRate,
    hsnCode: p.hsnCode ?? "",
    minOrderQty: p.minOrderQty ?? 1,
    stockQuantity: p.stockQuantity ?? 0,
    isActive: p.isActive,
    updatedAt: toIso(p.updatedAt),
  };
}

// Selling above MRP is illegal in India, so block it.
function assertPriceWithinMrp(defaultPrice, mrp) {
  if (mrp > 0 && defaultPrice > mrp) {
    throw Errors.validation({ defaultPrice: `Selling price cannot be more than MRP (${formatINR(mrp)}).` });
  }
}

async function assertSkuAvailable(companyId, sku, exceptId) {
  const clash = await Product.findOne({ companyId, sku, ...(exceptId && { _id: { $ne: exceptId } }) }).select("_id").lean();
  if (clash) throw Errors.conflict("Another product already uses this SKU.", { sku: "Another product already uses this SKU." });
}

async function requireProductDoc(companyId, productId) {
  assertObjectId(productId, "Product");
  const product = await Product.findOne({ _id: productId, companyId, archivedAt: null });
  if (!product) throw Errors.notFound("Product");
  return product;
}

export async function listProducts(companyId, { q, brandId, status, stock, page, limit }, { lowStockThreshold = 10 } = {}) {
  await connectDB();

  const filter = { companyId, archivedAt: null, ...tokenSearchFilter("searchText", q) };
  if (brandId) filter.brandId = brandId;
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  if (stock === "out") filter.stockQuantity = { $lte: 0 };
  if (stock === "low") filter.stockQuantity = { $gt: 0, $lte: lowStockThreshold };

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("brandId", "name")
      .lean(),
  ]);

  return { items: products.map(toAdminProductDTO), meta: pageMeta(page, limit, total) };
}

export async function getProduct(companyId, productId) {
  await connectDB();
  assertObjectId(productId, "Product");
  const product = await Product.findOne({ _id: productId, companyId, archivedAt: null }).populate("brandId", "name").lean();
  if (!product) throw Errors.notFound("Product");
  return toAdminProductDTO(product);
}

export async function createProduct(companyId, data) {
  await connectDB();
  const brand = await requireBrand(companyId, data.brandId); // brand must belong to THIS company
  assertPriceWithinMrp(data.defaultPrice, data.mrp);
  await assertSkuAvailable(companyId, data.sku);

  const product = await Product.create({
    ...data,
    companyId,
    brandId: brand._id,
    searchText: buildProductSearchText({ name: data.name, sku: data.sku, brandName: brand.name }),
  });

  return toAdminProductDTO({ ...product.toObject(), brandId: { _id: brand._id, name: brand.name } });
}

export async function updateProduct(companyId, productId, patch) {
  await connectDB();
  const product = await requireProductDoc(companyId, productId);

  const brand = await requireBrand(companyId, patch.brandId ?? String(product.brandId));
  if (patch.sku && patch.sku !== product.sku) await assertSkuAvailable(companyId, patch.sku, product._id);

  product.set(patch);
  assertPriceWithinMrp(product.defaultPrice, product.mrp);
  product.searchText = buildProductSearchText({ name: product.name, sku: product.sku, brandName: brand.name });

  // save() only writes the fields that changed, so it never touches
  // stockQuantity and can't undo a concurrent stock change.
  await product.save();
  return toAdminProductDTO({ ...product.toObject(), brandId: { _id: brand._id, name: brand.name } });
}

// Soft delete: the product disappears from all lists, but past orders keep
// their snapshot of it. The SKU is freed so it can be reused.
export async function archiveProduct(companyId, productId) {
  await connectDB();
  const product = await requireProductDoc(companyId, productId);
  await Product.updateOne(
    { _id: product._id, companyId },
    { $set: { archivedAt: new Date(), isActive: false, sku: `${product.sku}~DELETED~${product._id}` } },
  );
  return { id: toId(product._id), deleted: true };
}

// Manual stock correction (+ received goods, − damage/count correction).
// Uses one atomic $inc with a guard in the filter, so it's safe even if an
// order confirmation changes stock at the same moment.
export async function adjustStock(companyId, productId, change, { allowNegativeStock = false } = {}) {
  await connectDB();
  assertObjectId(productId, "Product");

  const filter = { _id: productId, companyId, archivedAt: null };
  if (change < 0 && !allowNegativeStock) filter.stockQuantity = { $gte: -change };

  const updated = await Product.findOneAndUpdate(filter, { $inc: { stockQuantity: change } }, { returnDocument: "after" })
    .populate("brandId", "name")
    .lean();

  if (!updated) {
    const current = await Product.findOne({ _id: productId, companyId, archivedAt: null }).select("stockQuantity").lean();
    if (!current) throw Errors.notFound("Product");
    throw Errors.unprocessable(
      `Only ${current.stockQuantity} in stock — can't remove ${-change}.`,
      "INSUFFICIENT_STOCK",
      { change: `Only ${current.stockQuantity} in stock.` },
    );
  }
  return toAdminProductDTO(updated);
}
