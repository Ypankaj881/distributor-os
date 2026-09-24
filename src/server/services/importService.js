import crypto from "node:crypto";
import { connectDB } from "../db.js";
import { Brand } from "../models/Brand.js";
import { Product } from "../models/Product.js";
import { Customer } from "../models/Customer.js";
import { Errors } from "../http/errors.js";
import { slugify } from "../utils.js";
import { createBrand } from "./brandService.js";
import { createProduct, updateProduct } from "./productService.js";
import { createCustomer, updateCustomer } from "./customerService.js";
import { setCustomerPrices } from "./pricingService.js";
import { productCreateSchema, productUpdateSchema } from "../validators/product.js";
import { customerCreateSchema, customerUpdateSchema } from "../validators/customer.js";
import { parseDelimited } from "../../lib/csv.js";
import { toPaise } from "../../lib/money.js";
import { normalizePhone } from "../../lib/phone.js";

// ============================================================================
// BULK IMPORT from CSV / pasted Excel cells.
// Two passes with the same code:
//   dryRun = true  → validate every row, report what WOULD happen, save nothing
//   dryRun = false → apply the valid rows through the normal services
// Rows go through the same validation and business rules as the screens
// (unique SKU, price ≤ MRP, valid phone…). Invalid rows are skipped and reported.
// ============================================================================

export const MAX_ROWS = 2000;

// Column names people are likely to use → our field names.
const ALIASES = {
  products: {
    brand: ["brand", "agency", "company", "brand name"],
    name: ["name", "product", "product name", "item", "item name"],
    sku: ["sku", "code", "product code", "item code"],
    unit: ["unit", "uom", "selling unit"],
    pack_size: ["pack size", "pack", "pcs per unit", "pieces per unit"],
    mrp: ["mrp"],
    price: ["price", "selling price", "rate", "default price", "dealer price"],
    gst: ["gst", "gst %", "gst rate", "tax", "tax %"],
    min_qty: ["min qty", "minimum qty", "moq", "min order", "minimum order"],
    stock: ["stock", "qty", "quantity", "opening stock"],
    hsn: ["hsn", "hsn code"],
    description: ["description", "details"],
    image_url: ["image", "image url", "photo"],
    active: ["active", "status"],
  },
  customers: {
    shop_name: ["shop", "shop name", "name", "firm", "business"],
    owner_name: ["owner", "owner name", "contact", "contact person"],
    phone: ["phone", "mobile", "mobile number", "phone number", "whatsapp"],
    email: ["email", "e-mail"],
    gstin: ["gstin", "gst no", "gst number"],
    code: ["code", "customer code", "party code"],
    address: ["address", "address line 1", "line1"],
    area: ["area", "address line 2", "line2", "locality"],
    city: ["city", "town"],
    state: ["state"],
    pincode: ["pincode", "pin", "pin code", "postal code"],
    credit_limit: ["credit limit", "credit"],
    payment_terms: ["payment terms", "terms"],
  },
  prices: {
    customer: ["customer", "shop", "customer code", "code", "phone", "mobile"],
    sku: ["sku", "product code", "item code"],
    price: ["price", "special price", "rate"],
    from: ["from", "effective from", "start"],
    to: ["to", "until", "valid until", "end"],
  },
};

function mapHeader(type, header) {
  const norm = header.map((h) => h.trim().toLowerCase().replace(/[_\s]+/g, " ").replace(/[^a-z0-9 %]/g, "").trim());
  const index = {};
  for (const [field, names] of Object.entries(ALIASES[type])) {
    const i = norm.findIndex((h) => h === field.replace(/_/g, " ") || names.includes(h));
    if (i >= 0) index[field] = i;
  }
  return index;
}

function readRows(type, text, required) {
  const table = parseDelimited(text);
  if (table.length < 2) throw Errors.validation({ file: "The file needs a header row and at least one data row." });
  if (table.length - 1 > MAX_ROWS) throw Errors.validation({ file: `Import at most ${MAX_ROWS} rows at a time.` });
  const index = mapHeader(type, table[0]);
  const missing = required.filter((f) => index[f] === undefined);
  if (missing.length) {
    throw Errors.validation({ file: `Missing column(s): ${missing.map((m) => m.replace(/_/g, " ")).join(", ")}. Download the template to see the expected columns.` });
  }
  return table.slice(1).map((cells, i) => ({
    row: i + 2, // spreadsheet row number (header is row 1)
    get: (f) => (index[f] === undefined ? "" : String(cells[index[f]] ?? "").trim()),
  }));
}

const money = (v) => (v === "" ? undefined : toPaise(v.replace(/[₹,\s]/g, "")));
const int = (v) => (v === "" ? undefined : Number(v.replace(/[,\s]/g, "")));
const bool = (v) => (v === "" ? undefined : !/^(no|n|false|0|inactive|off)$/i.test(v));
const zodErrors = (err) => err.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`);

function summarize(rows) {
  const count = (a) => rows.filter((r) => r.action === a).length;
  return { total: rows.length, create: count("create"), update: count("update"), error: count("error"), skip: count("skip") };
}

// ---------------------------------------------------------------------------
// Products (upsert by SKU; unknown brands are created)
// ---------------------------------------------------------------------------

export async function importProducts(companyId, text, { dryRun }) {
  await connectDB();
  const rows = readRows("products", text, ["brand", "name", "sku", "price"]);
  const [brands, existing] = await Promise.all([
    Brand.find({ companyId, archivedAt: null }).select("name slug").lean(),
    Product.find({ companyId, archivedAt: null }).select("sku").lean(),
  ]);
  const brandBySlug = new Map(brands.map((b) => [b.slug, { id: String(b._id), name: b.name }]));
  const productBySku = new Map(existing.map((p) => [p.sku, String(p._id)]));
  const seenSku = new Set();
  const newBrands = new Set();
  const results = [];

  for (const r of rows) {
    const sku = r.get("sku").toUpperCase();
    const out = { row: r.row, key: sku || r.get("name"), messages: [] };
    results.push(out);

    if (sku && seenSku.has(sku)) {
      out.action = "error";
      out.messages.push("This SKU appears more than once in the file.");
      continue;
    }
    seenSku.add(sku);

    const brandName = r.get("brand");
    const slug = slugify(brandName);
    if (!slug) {
      out.action = "error";
      out.messages.push("brand: Enter a brand name.");
      continue;
    }
    if (!brandBySlug.has(slug) && !newBrands.has(slug)) {
      newBrands.add(slug);
      out.messages.push(`New brand "${brandName}" will be created.`);
    }

    const existingId = productBySku.get(sku);
    const fields = {
      brandId: brandBySlug.get(slug)?.id ?? "000000000000000000000000", // placeholder id for validation of a new brand
      name: r.get("name"),
      sku,
      unit: r.get("unit") || undefined,
      packSize: int(r.get("pack_size")) ?? (existingId ? undefined : null),
      mrp: money(r.get("mrp")),
      defaultPrice: money(r.get("price")),
      gstRate: int(r.get("gst")),
      minOrderQty: int(r.get("min_qty")),
      hsnCode: r.get("hsn") || undefined,
      description: r.get("description") || undefined,
      imageUrl: r.get("image_url") || undefined,
      isActive: bool(r.get("active")),
    };
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

    const parsed = existingId
      ? productUpdateSchema.safeParse(clean)
      : productCreateSchema.safeParse({ ...clean, stockQuantity: int(r.get("stock")) ?? 0 });
    if (!parsed.success) {
      out.action = "error";
      out.messages.push(...zodErrors(parsed.error));
      continue;
    }
    if (parsed.data.mrp > 0 && parsed.data.defaultPrice > parsed.data.mrp) {
      out.action = "error";
      out.messages.push("price: Selling price cannot be more than MRP.");
      continue;
    }
    out.action = existingId ? "update" : "create";
    if (existingId && r.get("stock")) out.messages.push("Stock is not changed for existing products (use Add/Remove stock).");

    if (!dryRun) {
      try {
        let brand = brandBySlug.get(slug);
        if (!brand) {
          const b = await createBrand(companyId, { name: brandName, logoUrl: "", sortOrder: 0, isActive: true });
          brand = { id: b.id, name: b.name };
          brandBySlug.set(slug, brand);
        }
        const data = { ...parsed.data, brandId: brand.id };
        if (existingId) await updateProduct(companyId, existingId, data);
        else productBySku.set(sku, (await createProduct(companyId, data)).id);
      } catch (err) {
        out.action = "error";
        out.messages.push(err.fields ? Object.values(err.fields).join(" ") : err.message);
      }
    }
  }
  return { summary: { ...summarize(results), newBrands: newBrands.size }, rows: results };
}

// ---------------------------------------------------------------------------
// Shops (upsert by mobile number; new shops get a login with a generated password)
// ---------------------------------------------------------------------------

function readablePassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (chars, n) => Array.from(crypto.randomBytes(n), (b) => chars[b % chars.length]).join("");
  return pick(letters, 4) + pick(digits, 4);
}

export async function importCustomers(companyId, text, { dryRun }) {
  await connectDB();
  const rows = readRows("customers", text, ["shop_name", "phone"]);
  const existing = await Customer.find({ companyId }).select("phone customerCode").lean();
  const byPhone = new Map(existing.map((c) => [c.phone, String(c._id)]));
  const seen = new Set();
  const results = [];
  const logins = [];

  for (const r of rows) {
    const phone = normalizePhone(r.get("phone"));
    const out = { row: r.row, key: r.get("shop_name") || r.get("phone"), messages: [] };
    results.push(out);
    if (phone && seen.has(phone)) {
      out.action = "error";
      out.messages.push("This mobile number appears more than once in the file.");
      continue;
    }
    if (phone) seen.add(phone);

    const address = { line1: r.get("address"), line2: r.get("area"), landmark: "", city: r.get("city"), state: r.get("state"), pincode: r.get("pincode").replace(/\s/g, "") };
    const fields = {
      shopName: r.get("shop_name"),
      ownerName: r.get("owner_name"),
      phone: r.get("phone"),
      email: r.get("email"),
      gstin: r.get("gstin"),
      customerCode: r.get("code"),
      billingAddress: address,
      shippingAddress: address,
      creditLimit: money(r.get("credit_limit")) ?? 0,
      paymentTerms: r.get("payment_terms"),
    };
    const existingId = phone && byPhone.get(phone);

    if (existingId) {
      // Don't blank out details the file leaves empty.
      const patch = Object.fromEntries(Object.entries(fields).filter(([k, v]) => (typeof v === "string" ? v !== "" : k !== "creditLimit" || v > 0)));
      if (!Object.values(address).some(Boolean)) {
        delete patch.billingAddress;
        delete patch.shippingAddress;
      }
      delete patch.customerCode; // codes are not changed by import
      const parsed = customerUpdateSchema.safeParse(patch);
      if (!parsed.success) {
        out.action = "error";
        out.messages.push(...zodErrors(parsed.error));
        continue;
      }
      out.action = "update";
      out.messages.push("Existing shop (same mobile) — details updated, password unchanged.");
      if (!dryRun) {
        try {
          await updateCustomer(companyId, existingId, parsed.data);
        } catch (err) {
          out.action = "error";
          out.messages.push(err.fields ? Object.values(err.fields).join(" ") : err.message);
        }
      }
      continue;
    }

    const password = readablePassword();
    const parsed = customerCreateSchema.safeParse({ ...fields, notes: "", password });
    if (!parsed.success) {
      out.action = "error";
      out.messages.push(...zodErrors(parsed.error).filter((m) => !m.startsWith("password")));
      continue;
    }
    out.action = "create";
    if (!dryRun) {
      try {
        const c = await createCustomer(companyId, parsed.data);
        byPhone.set(c.phone, c.id);
        logins.push({ shopName: c.shopName, customerCode: c.customerCode, phone: c.phone, password });
      } catch (err) {
        out.action = "error";
        out.messages.push(err.fields ? Object.values(err.fields).join(" ") : err.message);
      }
    }
  }
  return { summary: summarize(results), rows: results, ...(dryRun ? {} : { logins }) };
}

// ---------------------------------------------------------------------------
// Special prices (customer code or mobile + SKU + price [+ from/to dates])
// ---------------------------------------------------------------------------

export async function importPrices(companyId, text, { dryRun, userId, timeZone }) {
  await connectDB();
  const rows = readRows("prices", text, ["customer", "sku", "price"]);
  const [customers, products] = await Promise.all([
    Customer.find({ companyId }).select("phone customerCode shopName").lean(),
    Product.find({ companyId, archivedAt: null }).select("sku mrp").lean(),
  ]);
  const customerByKey = new Map();
  for (const c of customers) {
    customerByKey.set(c.customerCode.toUpperCase(), c);
    customerByKey.set(c.phone, c);
  }
  const productBySku = new Map(products.map((p) => [p.sku, p]));
  const results = [];
  const groups = new Map(); // customerId|from|to → { customerId, from, to, prices: [], rows: [] }

  for (const r of rows) {
    const key = r.get("customer");
    const customer = customerByKey.get(key.toUpperCase()) ?? customerByKey.get(normalizePhone(key) ?? "");
    const product = productBySku.get(r.get("sku").toUpperCase());
    const price = money(r.get("price"));
    const from = r.get("from");
    const to = r.get("to");
    const out = { row: r.row, key: `${key} · ${r.get("sku")}`, messages: [] };
    results.push(out);

    if (!customer) out.messages.push(`customer: No shop with code or mobile "${key}".`);
    if (!product) out.messages.push(`sku: No product with SKU "${r.get("sku")}".`);
    if (!Number.isInteger(price) || price <= 0) out.messages.push("price: Enter a price above ₹0.");
    else if (product?.mrp > 0 && price > product.mrp) out.messages.push("price: Can't be more than MRP.");
    for (const [label, d] of [["from", from], ["to", to]]) {
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) out.messages.push(`${label}: Use the date format YYYY-MM-DD.`);
    }
    if (out.messages.length) {
      out.action = "error";
      continue;
    }
    out.action = "create";
    out.customer = customer.shopName;
    const gk = `${customer._id}|${from}|${to}`;
    if (!groups.has(gk)) groups.set(gk, { customerId: String(customer._id), from, to, prices: [], outs: [] });
    groups.get(gk).prices.push({ productId: String(product._id), price });
    groups.get(gk).outs.push(out);
  }

  if (!dryRun) {
    for (const g of groups.values()) {
      try {
        await setCustomerPrices(companyId, g.customerId, { prices: g.prices, effectiveFrom: g.from, effectiveTo: g.to || null }, { userId, timeZone });
      } catch (err) {
        for (const out of g.outs) {
          out.action = "error";
          out.messages.push(err.fields ? Object.values(err.fields).join(" ") : err.message);
        }
      }
    }
  }
  return { summary: summarize(results), rows: results };
}
