import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Brand } from "../models/Brand.js";
import { Product } from "../models/Product.js";
import { Errors } from "../http/errors.js";
import { assertObjectId, slugify, toId, toIso } from "../utils.js";
import { buildProductSearchText } from "./productSearch.js";

// Every function takes companyId as its first argument and includes it in
// EVERY query. companyId always comes from the logged-in session.

function toBrandDTO(brand, productCount = 0) {
  return {
    id: toId(brand._id),
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl ?? "",
    sortOrder: brand.sortOrder ?? 0,
    isActive: brand.isActive,
    productCount,
    updatedAt: toIso(brand.updatedAt),
  };
}

async function assertNameAvailable(companyId, slug, exceptId) {
  const clash = await Brand.findOne({ companyId, slug, ...(exceptId && { _id: { $ne: exceptId } }) }).select("_id").lean();
  if (clash) throw Errors.conflict("A brand with this name already exists.", { name: "A brand with this name already exists." });
}

// Loads a brand that belongs to this company, or throws 404.
export async function requireBrand(companyId, brandId) {
  assertObjectId(brandId, "Brand");
  const brand = await Brand.findOne({ _id: brandId, companyId, archivedAt: null });
  if (!brand) throw Errors.notFound("Brand");
  return brand;
}

// All brands with their (non-archived) product counts, for the admin Brands screen.
export async function listBrands(companyId) {
  await connectDB();
  const [brands, counts] = await Promise.all([
    Brand.find({ companyId, archivedAt: null }).sort({ sortOrder: 1, name: 1 }).lean(),
    Product.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(String(companyId)), archivedAt: null } },
      { $group: { _id: "$brandId", count: { $sum: 1 } } },
    ]),
  ]);
  // (aggregate() does not auto-cast string ids like find() does, hence the explicit ObjectId above)
  const countByBrand = new Map(counts.map((c) => [String(c._id), c.count]));
  return brands.map((b) => toBrandDTO(b, countByBrand.get(String(b._id)) ?? 0));
}

// Lightweight list for dropdowns.
export async function listBrandOptions(companyId) {
  await connectDB();
  const brands = await Brand.find({ companyId, archivedAt: null }).select("name isActive").sort({ sortOrder: 1, name: 1 }).lean();
  return brands.map((b) => ({ id: toId(b._id), name: b.name, isActive: b.isActive }));
}

export async function createBrand(companyId, data) {
  await connectDB();
  const slug = slugify(data.name);
  if (!slug) throw Errors.validation({ name: "Name must contain letters or numbers." });
  await assertNameAvailable(companyId, slug);
  const brand = await Brand.create({ ...data, companyId, slug });
  return toBrandDTO(brand);
}

export async function updateBrand(companyId, brandId, patch) {
  await connectDB();
  const brand = await requireBrand(companyId, brandId);
  const renamed = patch.name !== undefined && patch.name !== brand.name;

  if (renamed) {
    const slug = slugify(patch.name);
    if (!slug) throw Errors.validation({ name: "Name must contain letters or numbers." });
    await assertNameAvailable(companyId, slug, brand._id);
    brand.slug = slug;
  }

  brand.set(patch);
  await brand.save();

  // Product search text includes the brand name, so refresh it after a rename.
  if (renamed) await refreshSearchTextForBrand(companyId, brand);

  return toBrandDTO(brand);
}

// Soft delete. Refused while the brand still has products, so no product is
// left pointing at a missing brand.
export async function deleteBrand(companyId, brandId) {
  await connectDB();
  const brand = await requireBrand(companyId, brandId);
  const productCount = await Product.countDocuments({ companyId, brandId: brand._id, archivedAt: null });
  if (productCount > 0) {
    throw Errors.conflict(`This brand still has ${productCount} product(s). Delete or move them to another brand first.`);
  }
  // Free the name (unique slug) so a new brand can reuse it later.
  brand.set({ archivedAt: new Date(), isActive: false, slug: `${brand.slug}--deleted-${brand._id}` });
  await brand.save();
  return { id: toId(brand._id), deleted: true };
}

async function refreshSearchTextForBrand(companyId, brand) {
  const products = await Product.find({ companyId, brandId: brand._id }).select("name sku").lean();
  if (!products.length) return;
  await Product.bulkWrite(
    products.map((p) => ({
      updateOne: {
        filter: { _id: p._id, companyId },
        update: { $set: { searchText: buildProductSearchText({ name: p.name, sku: p.sku, brandName: brand.name }) } },
      },
    })),
  );
}
