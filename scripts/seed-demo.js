// DEMO DATA — for development and demos only.
//
//   npm run seed:demo             remove old demo data, then create it fresh
//   npm run seed:demo -- --remove remove demo data only
//   npm run seed:demo:prod        same, on the PRODUCTION database (e.g. for a demo before go-live)
//   npm run seed:demo:prod -- --remove
//
// Everything is created through the real services, so it obeys the same rules
// as the app (resolved prices, stock deducted on confirmation, timelines…).
// Every demo record is clearly marked and removable:
//   products  SKU starts with "DEMO-"      customers  code starts with "DEMO-"
//   shop names start with "[DEMO]"         descriptions say "DEMO DATA"
// Prices are ROUND PLACEHOLDER numbers — not real prices. Replace with the
// real catalogue before going live.
//
// Reads: DEFAULT_COMPANY_SLUG, SEED_DEMO_PASSWORD (password for all demo shop
// logins, min 8 chars). Needs an existing admin (npm run admin:create).
import mongoose from "mongoose";
import { env, runScript } from "./_shared.js";
import { Company } from "../src/server/models/Company.js";
import { User } from "../src/server/models/User.js";
import { Brand } from "../src/server/models/Brand.js";
import { Product } from "../src/server/models/Product.js";
import { Customer } from "../src/server/models/Customer.js";
import { CustomerPrice } from "../src/server/models/CustomerPrice.js";
import { Cart } from "../src/server/models/Cart.js";
import { Order } from "../src/server/models/Order.js";
import { Counter } from "../src/server/models/Counter.js";
import { createBrand } from "../src/server/services/brandService.js";
import { createProduct } from "../src/server/services/productService.js";
import { createCustomer } from "../src/server/services/customerService.js";
import { setCustomerPrices } from "../src/server/services/pricingService.js";
import { createOrder } from "../src/server/services/orderService.js";
import { confirmOrder, transitionOrder } from "../src/server/services/orderWorkflow.js";
import { recordPayment } from "../src/server/services/paymentService.js";
import { ROLES } from "../src/lib/constants.js";
import { addDays, dateKey, startOfDay, todayIn } from "../src/lib/dates.js";

if (process.env.NODE_ENV === "production") {
  console.error("✘ Refusing to seed demo data with NODE_ENV=production.");
  process.exit(1);
}

const REMOVE_ONLY = process.argv.includes("--remove");

// Extra guard for the production database: only with an explicit flag
// (npm run seed:demo:prod), so demo data can't end up there by accident.
const dbName = process.env.MONGODB_DB ?? "";
if (/_prod$/.test(dbName) && !process.argv.includes("--allow-production-db")) {
  console.error(`✘ "${dbName}" looks like the PRODUCTION database. Use "npm run seed:demo:prod" if you really want demo data there.`);
  process.exit(1);
}
const slug = env("DEFAULT_COMPANY_SLUG").toLowerCase();
const password = REMOVE_ONLY ? null : env("SEED_DEMO_PASSWORD");
if (password && password.length < 8) {
  console.error("✘ SEED_DEMO_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const DEMO_NOTE = "DEMO DATA — placeholder product and price. Replace with the real catalogue.";
const BRANDS = ["Bellavita", "Natraj", "Apsara", "Fastrack"];

// [brand, key, name, unit, packSize, price ₹, mrp ₹, gst %, moq, stock]
const PRODUCTS = [
  ["Bellavita", "BV-CEO", "CEO Perfume 100ml", "bottle", null, 500, 800, 18, 2, 120],
  ["Bellavita", "BV-KLUB", "KLUB Perfume 100ml", "bottle", null, 450, 700, 18, 2, 80],
  ["Bellavita", "BV-GOAT", "GOAT Perfume 100ml", "bottle", null, 450, 700, 18, 2, 8],
  ["Bellavita", "BV-A", "Demo Perfume A 50ml", "bottle", null, 250, 400, 18, 1, 60],
  ["Bellavita", "BV-B", "Demo Perfume B 50ml", "bottle", null, 250, 400, 18, 1, 0],
  ["Bellavita", "BV-GIFT", "Demo Gift Set (4 x 20ml)", "set", 4, 600, 1000, 18, 1, 25],
  ["Natraj", "NT-HB", "HB Pencil", "box", 10, 50, 60, 12, 5, 400],
  ["Natraj", "NT-ERASER", "Eraser", "box", 20, 60, 80, 12, 5, 300],
  ["Natraj", "NT-SHARP", "Sharpener", "box", 20, 60, 80, 12, 5, 250],
  ["Natraj", "NT-GEO", "Geometry Box", "piece", null, 100, 150, 18, 6, 90],
  ["Natraj", "NT-PEN", "Demo Ball Pen", "box", 10, 50, 70, 18, 5, 12],
  ["Natraj", "NT-SCALE", "Scale 30cm", "dozen", 12, 100, 144, 12, 1, 40],
  ["Apsara", "AP-PLAT", "Platinum Pencil", "box", 10, 60, 70, 12, 5, 350],
  ["Apsara", "AP-ABS", "Absolute Pencil", "box", 10, 60, 70, 12, 5, 200],
  ["Apsara", "AP-ERASER", "Non-dust Eraser", "box", 20, 50, 70, 12, 5, 180],
  ["Apsara", "AP-SHARP", "Long Point Sharpener", "box", 20, 60, 80, 12, 5, 9],
  ["Apsara", "AP-KIT", "Demo Drawing Kit", "piece", null, 150, 200, 18, 3, 45],
  ["Apsara", "AP-COLOR", "Demo Colour Pencils", "box", 12, 100, 130, 12, 3, 70],
  ["Fastrack", "FT-A", "Demo Perfume A 100ml", "bottle", null, 400, 600, 18, 1, 50],
  ["Fastrack", "FT-B", "Demo Perfume B 100ml", "bottle", null, 400, 600, 18, 1, 35],
  ["Fastrack", "FT-DEO", "Demo Deodorant 150ml", "piece", null, 150, 250, 18, 6, 140],
  ["Fastrack", "FT-TRAVEL", "Demo Travel Pack (3 x 20ml)", "set", 3, 300, 450, 18, 1, 20],
  ["Fastrack", "FT-OLD", "Demo Discontinued Item", "piece", null, 100, 150, 18, 1, 30], // made inactive below
  ["Fastrack", "FT-BODY", "Demo Body Spray 120ml", "piece", null, 120, 199, 18, 6, 110],
];

// [code, shop, owner, phone, city, credit days (null = company default)]
const SHOPS = [
  ["DEMO-001", "[DEMO] Sharma General Store", "Demo Rajesh Sharma", "9000000001", "Nagpur", 7],
  ["DEMO-002", "[DEMO] Gupta Stationers", "Demo Anil Gupta", "9000000002", "Nagpur", 15],
  ["DEMO-003", "[DEMO] Patel Cosmetics", "Demo Meena Patel", "9000000003", "Wardha", 0],
  ["DEMO-004", "[DEMO] Verma Kirana", "Demo Sunil Verma", "9000000004", "Nagpur", 7],
  ["DEMO-005", "[DEMO] Khan Gift Centre", "Demo Imran Khan", "9000000005", "Amravati", null],
];

// Special prices per shop (₹). Future-dated ones show "upcoming" in the pricing grid.
const SPECIAL_PRICES = {
  "DEMO-001": [["BV-CEO", 470], ["BV-KLUB", 430], ["NT-HB", 46]],
  "DEMO-002": [["NT-HB", 45], ["NT-ERASER", 55], ["AP-PLAT", 55], ["AP-ABS", 55]],
  "DEMO-003": [["BV-CEO", 480], ["BV-GIFT", 560], ["FT-A", 380]],
  "DEMO-005": [["BV-GIFT", 570], ["FT-TRAVEL", 280]],
};
const SCHEDULED = { shop: "DEMO-001", sku: "BV-CEO", price: 450, inDays: 7, forDays: 14 };

// [shop code, days ago, [[sku, qty]…], final status, extras]
const ORDERS = [
  ["DEMO-001", 12, [["BV-CEO", 10], ["NT-HB", 20], ["AP-PLAT", 10]], "DELIVERED", { paid: "PAID" }],
  ["DEMO-002", 10, [["NT-HB", 50], ["NT-ERASER", 20], ["NT-SHARP", 20], ["AP-ABS", 30]], "DELIVERED", {}],
  ["DEMO-003", 8, [["BV-CEO", 6], ["BV-KLUB", 6], ["BV-GIFT", 4]], "DELIVERED", { paid: "PARTIAL" }],
  ["DEMO-005", 6, [["BV-GIFT", 5], ["FT-TRAVEL", 4], ["FT-A", 3]], "CANCELLED", { note: "Demo: shop closed for renovation" }],
  ["DEMO-004", 4, [["FT-DEO", 12], ["FT-BODY", 12], ["NT-HB", 10]], "DISPATCHED", { note: "Demo: sent with delivery van 1" }],
  ["DEMO-002", 3, [["AP-PLAT", 40], ["AP-ERASER", 20], ["AP-SHARP", 9]], "PACKED", {}],
  ["DEMO-001", 2, [["BV-GOAT", 6], ["NT-GEO", 12], ["NT-PEN", 10]], "CONFIRMED", { partial: { "NT-PEN": 5 }, note: "Demo: remaining pens next week" }],
  ["DEMO-003", 1, [["BV-A", 4], ["FT-B", 3]], "NEW", { notes: "Demo: please deliver before 5 pm" }],
  ["DEMO-004", 0, [["NT-HB", 20], ["AP-COLOR", 6], ["FT-DEO", 6]], "NEW", {}],
];

const paise = (rupees) => Math.round(rupees * 100);

// ---------------------------------------------------------------------------

async function removeDemo(companyId) {
  const customers = await Customer.find({ companyId, customerCode: /^DEMO-/ }).select("_id").lean();
  const customerIds = customers.map((c) => c._id);
  const result = {
    orders: (await Order.deleteMany({ companyId, customerId: { $in: customerIds } })).deletedCount,
    carts: (await Cart.deleteMany({ companyId, customerId: { $in: customerIds } })).deletedCount,
    prices: (await CustomerPrice.deleteMany({ companyId, customerId: { $in: customerIds } })).deletedCount,
    logins: (await User.deleteMany({ companyId, customerId: { $in: customerIds } })).deletedCount,
    customers: (await Customer.deleteMany({ _id: { $in: customerIds } })).deletedCount,
    // Products whose SKU starts with DEMO- (including soft-deleted ones: "DEMO-X~DELETED~…")
    products: (await Product.deleteMany({ companyId, sku: /^DEMO-/ })).deletedCount,
    brands: 0,
  };
  // Seeded brands that no longer have any product (real products keep their brand).
  for (const name of BRANDS) {
    const brand = await Brand.findOne({ companyId, name, archivedAt: null });
    if (brand && !(await Product.exists({ companyId, brandId: brand._id }))) {
      await Brand.deleteOne({ _id: brand._id });
      result.brands += 1;
    }
  }
  // Reset numbering only if nothing real depends on it.
  if (!(await Order.exists({ companyId }))) await Counter.deleteOne({ companyId, key: "order" });
  return result;
}

// Moves an order (and its history) back in time, keeping the gaps between steps.
async function backdate(orderId, daysAgo, timeZone, hour) {
  const order = await Order.findById(orderId).lean();
  const base = new Date(startOfDay(addDays(todayIn(timeZone), -daysAgo), timeZone).getTime() + hour * 3600_000);
  const shift = base.getTime() - new Date(order.createdAt).getTime();
  const stepGap = 2 * 3600_000; // spread each later step 2 h apart
  const timeline = order.timeline.map((t, i) => ({ ...t, at: new Date(base.getTime() + i * stepGap) }));
  // createdAt is immutable in Mongoose, so write through the raw collection.
  const set = { createdAt: new Date(new Date(order.createdAt).getTime() + shift), updatedAt: timeline.at(-1).at, timeline };
  // Delivered orders fall due creditDays after the (backdated) delivery day.
  if (order.status === "DELIVERED") set.dueOn = addDays(dateKey(timeline.at(-1).at, timeZone), order.creditDays ?? 0);
  await Order.collection.updateOne({ _id: order._id }, { $set: set });
}

await runScript(async () => {
  const company = await Company.findOne({ slug });
  if (!company) throw new Error(`Company "${slug}" not found. Run "npm run admin:create" first.`);
  const companyId = String(company._id);

  const removed = await removeDemo(company._id);
  console.log("• Removed previous demo data:", JSON.stringify(removed));
  if (REMOVE_ONLY) return;

  const admin = await User.findOne({ companyId, role: ROLES.ADMIN, isActive: true }).lean();
  if (!admin) throw new Error('No admin found. Run "npm run admin:create" first.');
  const actor = { userId: String(admin._id), name: admin.name, role: ROLES.ADMIN };
  const settings = company.settings?.toObject?.() ?? company.settings ?? {};
  const timeZone = settings.timezone ?? "Asia/Kolkata";

  // Brands (reuse existing ones with the same name).
  const brandIds = {};
  for (const name of BRANDS) {
    const existing = await Brand.findOne({ companyId, name, archivedAt: null }).lean();
    brandIds[name] = existing ? String(existing._id) : (await createBrand(companyId, { name, logoUrl: "", sortOrder: BRANDS.indexOf(name), isActive: true })).id;
  }

  // Products.
  const productIds = {};
  for (const [brand, key, name, unit, packSize, price, mrp, gstRate, minOrderQty, stockQuantity] of PRODUCTS) {
    const p = await createProduct(companyId, {
      brandId: brandIds[brand], name, sku: `DEMO-${key}`, description: DEMO_NOTE, imageUrl: "",
      unit, packSize, mrp: paise(mrp), defaultPrice: paise(price), gstRate, hsnCode: "", minOrderQty, stockQuantity, isActive: true,
    });
    productIds[key] = p.id;
  }

  // Shops + logins.
  const shopIds = {};
  for (const [code, shopName, ownerName, phone, city, creditDays] of SHOPS) {
    const address = { line1: "Demo address, Main Road", city, state: "Maharashtra", pincode: "440001" };
    const c = await createCustomer(companyId, {
      customerCode: code, shopName, ownerName, phone, password, email: "", gstin: "",
      billingAddress: address, shippingAddress: address, creditLimit: paise(50000), creditDays,
      paymentTerms: creditDays == null ? "Demo: company default" : creditDays === 0 ? "Demo: cash on delivery" : `Demo: ${creditDays} days credit`, notes: "Demo customer",
    });
    shopIds[code] = c.id;
  }

  // Special prices (effective now), plus one scheduled future price.
  for (const [code, list] of Object.entries(SPECIAL_PRICES)) {
    await setCustomerPrices(companyId, shopIds[code], { prices: list.map(([sku, price]) => ({ productId: productIds[sku], price: paise(price) })) }, { userId: actor.userId, timeZone });
  }
  const today = todayIn(timeZone);
  await setCustomerPrices(
    companyId, shopIds[SCHEDULED.shop],
    { prices: [{ productId: productIds[SCHEDULED.sku], price: paise(SCHEDULED.price) }], effectiveFrom: addDays(today, SCHEDULED.inDays), effectiveTo: addDays(today, SCHEDULED.inDays + SCHEDULED.forDays) },
    { userId: actor.userId, timeZone },
  );

  // Orders, oldest first so numbers go up with time, each walked through the real workflow.
  for (const [code, daysAgo, lines, finalStatus, extra] of ORDERS) {
    const shopUser = await User.findOne({ companyId, customerId: shopIds[code] }).lean();
    const { order } = await createOrder({
      companyId, customerId: shopIds[code], settings,
      items: lines.map(([sku, quantity]) => ({ productId: productIds[sku], quantity })),
      actor: { userId: String(shopUser._id), name: shopUser.name, role: ROLES.RETAILER },
      notes: extra.notes ?? "",
    }).catch((err) => {
      throw new Error(`Demo order for ${code} (${daysAgo} days ago) failed: ${err.message}`);
    });
    const id = String(order._id);
    const path = { NEW: [], CONFIRMED: ["CONFIRMED"], PACKED: ["CONFIRMED", "PACKED"], DISPATCHED: ["CONFIRMED", "PACKED", "DISPATCHED"], DELIVERED: ["CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"], CANCELLED: ["CONFIRMED", "CANCELLED"] }[finalStatus];
    for (const step of path) {
      if (step === "CONFIRMED") {
        const quantities = Object.entries(extra.partial ?? {}).map(([sku, confirmedQty]) => ({
          itemId: String(order.items.find((i) => String(i.productId) === productIds[sku])._id),
          confirmedQty,
        }));
        await confirmOrder(companyId, id, { quantities, note: extra.partial ? extra.note : "" }, actor, settings);
      } else {
        const note = step === finalStatus && !extra.partial ? (extra.note ?? "") : "";
        await transitionOrder(companyId, id, { status: step, note }, actor);
      }
    }
    await backdate(id, daysAgo, timeZone, 10 + (daysAgo % 5));
    // Payments are recorded like a real receipt, dated the delivery day.
    if (extra.paid) {
      const o = await Order.findById(id).lean();
      const amount = extra.paid === "PAID" ? o.grandTotal : Math.round(o.grandTotal / 2);
      await recordPayment(companyId, id, { amount, mode: extra.paid === "PAID" ? "UPI" : "CASH", paidOn: o.dueOn ? dateKey(o.timeline.at(-1).at, timeZone) : "", reference: "DEMO" }, actor, { timeZone });
    }
  }

  // One product made inactive after use, to show "no longer available" handling.
  await Product.updateOne({ companyId, sku: "DEMO-FT-OLD" }, { $set: { isActive: false } });

  const orderCount = await Order.countDocuments({ companyId, customerId: { $in: Object.values(shopIds).map((i) => new mongoose.Types.ObjectId(i)) } });
  console.log(`✔ Demo data created: ${BRANDS.length} brands, ${PRODUCTS.length} products, ${SHOPS.length} shops, ${orderCount} orders.`);
  console.log("\nDemo shop logins (password = SEED_DEMO_PASSWORD):");
  for (const [, shopName, , phone] of SHOPS) console.log(`  ${phone}  ${shopName}`);
  console.log("\nShop:  http://localhost:3000/login\nAdmin: http://localhost:3000/admin/login  (your admin account)");
  console.log('Remove all demo data any time with:  npm run seed:demo -- --remove');
});
