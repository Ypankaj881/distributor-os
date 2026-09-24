import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Customer } from "../models/Customer.js";
import { User } from "../models/User.js";
import { nextSequence } from "../models/Counter.js";
import { Errors } from "../http/errors.js";
import { hashPassword } from "../auth/password.js";
import { assertObjectId, normalizeSearch, pageMeta, tokenSearchFilter, toId, toIso } from "../utils.js";
import { ROLES } from "../../lib/constants.js";

// A customer (shop) and its retailer login (User) are managed together:
// create/deactivate/phone change always update both, inside a transaction.

const ADDRESS_KEYS = ["line1", "line2", "landmark", "city", "state", "pincode"];

function cleanAddress(a = {}) {
  return Object.fromEntries(ADDRESS_KEYS.map((k) => [k, a?.[k] ?? ""]));
}

export function buildCustomerSearchText(c) {
  return normalizeSearch(
    `${c.shopName} ${c.ownerName ?? ""} ${c.phone} ${c.customerCode} ${c.billingAddress?.city ?? ""}`,
  );
}

function defaultShipping(customer) {
  return customer.shippingAddresses?.find((a) => a.isDefault) ?? customer.shippingAddresses?.[0] ?? null;
}

function toListDTO(c) {
  return {
    id: toId(c._id),
    customerCode: c.customerCode,
    shopName: c.shopName,
    ownerName: c.ownerName ?? "",
    phone: c.phone,
    city: c.billingAddress?.city || defaultShipping(c)?.city || "",
    isActive: c.isActive,
    createdAt: toIso(c.createdAt),
  };
}

function toDetailDTO(c, user) {
  const ship = defaultShipping(c);
  return {
    ...toListDTO(c),
    email: c.email ?? "",
    gstin: c.gstin ?? "",
    billingAddress: cleanAddress(c.billingAddress),
    shippingAddress: cleanAddress(ship),
    creditLimit: c.creditLimit ?? 0,
    paymentTerms: c.paymentTerms ?? "",
    creditDays: c.creditDays ?? null,
    notes: c.notes ?? "",
    updatedAt: toIso(c.updatedAt),
    login: user
      ? { exists: true, phone: user.phone, isActive: user.isActive, lastLoginAt: toIso(user.lastLoginAt) }
      : { exists: false, phone: c.phone, isActive: false, lastLoginAt: null },
  };
}

// Loads a customer of THIS company or throws 404. Exported for pricing, cart, orders.
export async function requireCustomer(companyId, customerId, { session = null } = {}) {
  assertObjectId(customerId, "Customer");
  const customer = await Customer.findOne({ _id: customerId, companyId }).session(session);
  if (!customer) throw Errors.notFound("Customer");
  return customer;
}

// A phone number is the retailer's login, so it must be unique across all
// shops AND all users (admins included) of the company.
// (Queries run one after another: a transaction session can't run operations in parallel.)
async function assertPhoneAvailable(companyId, phone, { exceptCustomerId, session = null } = {}) {
  const customer = await Customer.findOne({ companyId, phone, ...(exceptCustomerId && { _id: { $ne: exceptCustomerId } }) })
    .select("shopName").session(session).lean();
  const user = customer
    ? null
    : await User.findOne({ companyId, phone, ...(exceptCustomerId && { customerId: { $ne: exceptCustomerId } }) })
        .select("_id").session(session).lean();
  if (customer || user) {
    const msg = customer ? `Already used by ${customer.shopName}.` : "Already used by another login.";
    throw Errors.conflict("This mobile number is already registered.", { phone: msg });
  }
}

async function assertCodeAvailable(companyId, customerCode, { exceptCustomerId, session = null } = {}) {
  const clash = await Customer.findOne({ companyId, customerCode, ...(exceptCustomerId && { _id: { $ne: exceptCustomerId } }) })
    .select("_id").session(session).lean();
  if (clash) throw Errors.conflict("This customer code is already used.", { customerCode: "Already used by another customer." });
}

// C0001, C0002 … skipping any code an admin already typed in manually.
async function generateCustomerCode(companyId, session) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = `C${String(await nextSequence(companyId, "customer", { session })).padStart(4, "0")}`;
    const taken = await Customer.exists({ companyId, customerCode: code }).session(session);
    if (!taken) return code;
  }
  throw new Error("Could not generate a free customer code.");
}

async function inTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// ---------------------------------------------------------------------------

export async function listCustomers(companyId, { q, status, page, limit }) {
  await connectDB();
  const filter = { companyId, ...tokenSearchFilter("searchText", q) };
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;

  const [total, customers] = await Promise.all([
    Customer.countDocuments(filter),
    Customer.find(filter).sort({ shopName: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { items: customers.map(toListDTO), meta: pageMeta(page, limit, total) };
}

export async function getCustomer(companyId, customerId) {
  await connectDB();
  const customer = await requireCustomer(companyId, customerId);
  const user = await User.findOne({ companyId, customerId: customer._id, role: ROLES.RETAILER }).lean();
  return toDetailDTO(customer.toObject(), user);
}

export async function createCustomer(companyId, { password, shippingAddress, ...data }) {
  await connectDB();
  const passwordHash = await hashPassword(password); // slow (bcrypt) → outside the transaction

  const id = await inTransaction(async (session) => {
    await assertPhoneAvailable(companyId, data.phone, { session });
    const customerCode = data.customerCode || (await generateCustomerCode(companyId, session));
    if (data.customerCode) await assertCodeAvailable(companyId, customerCode, { session });

    const doc = {
      ...data,
      companyId,
      customerCode,
      billingAddress: cleanAddress(data.billingAddress),
      shippingAddresses: [{ label: "Shop", ...cleanAddress(shippingAddress), isDefault: true }],
    };
    doc.searchText = buildCustomerSearchText(doc);

    const [customer] = await Customer.create([doc], { session });
    await User.create(
      [{ companyId, role: ROLES.RETAILER, name: data.ownerName || data.shopName, phone: data.phone, customerId: customer._id, passwordHash }],
      { session },
    );
    return customer._id;
  });

  return getCustomer(companyId, String(id));
}

export async function updateCustomer(companyId, customerId, { shippingAddress, ...patch }) {
  await connectDB();

  await inTransaction(async (session) => {
    const customer = await requireCustomer(companyId, customerId, { session });
    const phoneChanged = patch.phone && patch.phone !== customer.phone;

    if (phoneChanged) await assertPhoneAvailable(companyId, patch.phone, { exceptCustomerId: customer._id, session });
    if (patch.customerCode === "") delete patch.customerCode; // keep existing code
    if (patch.customerCode && patch.customerCode !== customer.customerCode) {
      await assertCodeAvailable(companyId, patch.customerCode, { exceptCustomerId: customer._id, session });
    }
    if (patch.billingAddress) patch.billingAddress = cleanAddress(patch.billingAddress);

    customer.set(patch);
    if (shippingAddress) {
      const current = customer.shippingAddresses.find((a) => a.isDefault) ?? customer.shippingAddresses[0];
      if (current) current.set(cleanAddress(shippingAddress));
      else customer.shippingAddresses.push({ label: "Shop", ...cleanAddress(shippingAddress), isDefault: true });
    }
    customer.searchText = buildCustomerSearchText(customer);
    await customer.save({ session });

    // Keep the login in sync: phone is the login ID, owner name is the display name.
    const userUpdate = {};
    if (phoneChanged) userUpdate.phone = customer.phone;
    if (patch.ownerName !== undefined || patch.shopName !== undefined) userUpdate.name = customer.ownerName || customer.shopName;
    if (Object.keys(userUpdate).length) {
      await User.updateMany({ companyId, customerId: customer._id }, { $set: userUpdate }, { session });
    }
  });

  return getCustomer(companyId, customerId);
}

// Deactivating blocks login immediately (tokenVersion++ ends open sessions).
export async function setCustomerActive(companyId, customerId, isActive) {
  await connectDB();
  await inTransaction(async (session) => {
    const customer = await requireCustomer(companyId, customerId, { session });
    customer.isActive = isActive;
    await customer.save({ session });
    await User.updateMany({ companyId, customerId: customer._id }, { $set: { isActive }, $inc: { tokenVersion: 1 } }, { session });
  });
  return getCustomer(companyId, customerId);
}

// Admin sets a new password (e.g. the shopkeeper forgot it). Logs out all
// of the shop's devices. Creates the login if the shop somehow has none.
export async function resetCustomerPassword(companyId, customerId, password) {
  await connectDB();
  const customer = await requireCustomer(companyId, customerId);
  const passwordHash = await hashPassword(password);

  const updated = await User.findOneAndUpdate(
    { companyId, customerId: customer._id, role: ROLES.RETAILER },
    { $set: { passwordHash }, $inc: { tokenVersion: 1 } },
  );
  if (!updated) {
    await assertPhoneAvailable(companyId, customer.phone, { exceptCustomerId: customer._id });
    await User.create({
      companyId, role: ROLES.RETAILER, name: customer.ownerName || customer.shopName,
      phone: customer.phone, customerId: customer._id, passwordHash, isActive: customer.isActive,
    });
  }
  return { reset: true };
}

// Delivery addresses for the SHOP itself (checkout, account). Only address
// fields — never admin-only data like notes or credit limit.
export async function getShopAddresses(companyId, customerId) {
  await connectDB();
  const customer = await requireCustomer(companyId, customerId);
  return customer.shippingAddresses.map((a) => ({
    id: toId(a._id),
    label: a.label || "Shop",
    ...cleanAddress(a),
    isDefault: Boolean(a.isDefault),
  }));
}

// ---------------------------------------------------------------------------
// The SHOP managing its own profile and delivery addresses.
// Shop name, phone (= login) and GSTIN stay with the distributor; the shop
// may change its contact name, email and addresses. Past orders keep their
// own address snapshot, so editing an address never changes an old order.
// ---------------------------------------------------------------------------

const MAX_ADDRESSES = 10;

export async function getShopProfile(companyId, customerId) {
  await connectDB();
  const c = await requireCustomer(companyId, customerId);
  return {
    shopName: c.shopName,
    ownerName: c.ownerName ?? "",
    phone: c.phone,
    email: c.email ?? "",
    gstin: c.gstin ?? "",
    customerCode: c.customerCode,
  };
}

export async function updateShopProfile(companyId, customerId, { ownerName, email }) {
  await connectDB();
  await inTransaction(async (session) => {
    const c = await requireCustomer(companyId, customerId, { session });
    if (ownerName !== undefined) c.ownerName = ownerName;
    if (email !== undefined) c.email = email;
    c.searchText = buildCustomerSearchText(c);
    await c.save({ session });
    if (ownerName !== undefined) {
      await User.updateMany({ companyId, customerId: c._id }, { $set: { name: ownerName || c.shopName } }, { session });
    }
  });
  return getShopProfile(companyId, customerId);
}

export async function addShopAddress(companyId, customerId, { isDefault, ...address }) {
  await connectDB();
  const c = await requireCustomer(companyId, customerId);
  if (c.shippingAddresses.length >= MAX_ADDRESSES) {
    throw Errors.unprocessable(`You can save up to ${MAX_ADDRESSES} addresses.`, "TOO_MANY_ADDRESSES");
  }
  const makeDefault = isDefault || c.shippingAddresses.length === 0;
  if (makeDefault) c.shippingAddresses.forEach((a) => (a.isDefault = false));
  c.shippingAddresses.push({ label: address.label || "Shop", ...cleanAddress(address), isDefault: makeDefault });
  await c.save();
  return getShopAddresses(companyId, customerId);
}

export async function updateShopAddress(companyId, customerId, addressId, { isDefault, ...address }) {
  await connectDB();
  assertObjectId(addressId, "Address");
  const c = await requireCustomer(companyId, customerId);
  const a = c.shippingAddresses.id(addressId);
  if (!a) throw Errors.notFound("Address");
  a.set({ ...(address.label !== undefined && { label: address.label || "Shop" }), ...pick(address, ADDRESS_KEYS) });
  if (isDefault) c.shippingAddresses.forEach((x) => (x.isDefault = String(x._id) === String(a._id)));
  await c.save();
  return getShopAddresses(companyId, customerId);
}

export async function deleteShopAddress(companyId, customerId, addressId) {
  await connectDB();
  assertObjectId(addressId, "Address");
  const c = await requireCustomer(companyId, customerId);
  const a = c.shippingAddresses.id(addressId);
  if (!a) throw Errors.notFound("Address");
  const wasDefault = a.isDefault;
  a.deleteOne();
  if (wasDefault && c.shippingAddresses.length) c.shippingAddresses[0].isDefault = true;
  await c.save();
  return getShopAddresses(companyId, customerId);
}

function pick(obj, keys) {
  return Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
}
