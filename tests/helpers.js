// Shared setup for integration tests. They run the REAL services against a
// separate MongoDB database (MONGODB_DB from .env.test), which is dropped at the
// start of each test file so every file starts clean.
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/server/db.js";
import { Company } from "../src/server/models/Company.js";
import { User } from "../src/server/models/User.js";
import { hashPassword } from "../src/server/auth/password.js";
import { loadAuthContext } from "../src/server/services/authService.js";
import { createBrand } from "../src/server/services/brandService.js";
import { createProduct } from "../src/server/services/productService.js";
import { createCustomer } from "../src/server/services/customerService.js";
import { ROLES } from "../src/lib/constants.js";

let phoneSeq = 0;
let skuSeq = 0;

export async function setupTestDb() {
  await connectDB();
  const name = mongoose.connection.name;
  // Safety net: never wipe a real database.
  if (!name.endsWith("_test")) throw new Error(`Refusing to run tests against database "${name}" (must end with _test).`);
  await mongoose.connection.db.dropDatabase();
  // Recreate indexes (unique/partial ones matter for the tests).
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

// Drop the test database afterwards too, so it doesn't linger in the cluster.
export async function teardownTestDb() {
  if (mongoose.connection.name?.endsWith("_test")) await mongoose.connection.db.dropDatabase();
  await disconnectDB();
}

export async function makeCompany(slug = `co-${Math.random().toString(36).slice(2, 8)}`, settings = {}) {
  return Company.create({ name: `Company ${slug}`, slug, settings: { orderPrefix: "T", ...settings } });
}

// An auth context exactly like the one route handlers get from the session.
export async function authFor(user) {
  return loadAuthContext({
    userId: String(user._id),
    companyId: String(user.companyId),
    role: user.role,
    customerId: user.customerId ? String(user.customerId) : null,
    tokenVersion: user.tokenVersion ?? 0,
  });
}

export async function makeAdmin(company) {
  const user = await User.create({
    companyId: company._id,
    role: ROLES.ADMIN,
    name: "Test Admin",
    email: `admin-${company.slug}@test.local`,
    passwordHash: await hashPassword("admin-pass-1"),
  });
  return authFor(user);
}

export function nextPhone() {
  phoneSeq += 1;
  return `9${String(100000000 + phoneSeq).slice(-9)}`;
}

// A shop (+ its login) and the retailer's auth context.
export async function makeShop(company, overrides = {}) {
  const customer = await createCustomer(String(company._id), {
    shopName: overrides.shopName ?? `Shop ${phoneSeq + 1}`,
    phone: overrides.phone ?? nextPhone(),
    password: overrides.password ?? "shop-pass-1",
    ownerName: "", email: "", gstin: "", customerCode: "", billingAddress: {}, shippingAddress: { line1: "1 Test Rd", city: "Nagpur", pincode: "440001" },
    creditLimit: 0, paymentTerms: "", notes: "",
  });
  const user = await User.findOne({ companyId: company._id, customerId: customer.id });
  return { customer, auth: await authFor(user) };
}

export async function makeBrand(company, name = `Brand ${Math.random().toString(36).slice(2, 7)}`) {
  return createBrand(String(company._id), { name, logoUrl: "", sortOrder: 0, isActive: true });
}

export async function makeProduct(company, brand, overrides = {}) {
  skuSeq += 1;
  return createProduct(String(company._id), {
    brandId: brand.id,
    name: overrides.name ?? `Product ${skuSeq}`,
    sku: overrides.sku ?? `SKU-${skuSeq}`,
    description: "", imageUrl: "", unit: "box", packSize: null, hsnCode: "",
    mrp: overrides.mrp ?? 0,
    defaultPrice: overrides.defaultPrice ?? 10000,
    gstRate: overrides.gstRate ?? 18,
    minOrderQty: overrides.minOrderQty ?? 1,
    stockQuantity: overrides.stockQuantity ?? 100,
    isActive: overrides.isActive ?? true,
  });
}

// Expect a promise to reject with an AppError of the given status/code.
export async function rejectsWith(promise, { status, code }) {
  try {
    await promise;
  } catch (err) {
    if (status && err.status !== status) throw new Error(`Expected status ${status}, got ${err.status} (${err.code}: ${err.message})`);
    if (code && err.code !== code) throw new Error(`Expected code ${code}, got ${err.code} (${err.message})`);
    return err;
  }
  throw new Error(`Expected rejection with ${status ?? ""} ${code ?? ""}, but it resolved.`);
}
