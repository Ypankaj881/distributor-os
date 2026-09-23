// DEVELOPMENT ONLY: creates a demo shop (Customer) plus its retailer login, so
// the retailer login can be tested before the admin customer screens exist
// (Phase 4). The full demo seed (Phase 14) replaces this.
//
// Reads: DEFAULT_COMPANY_SLUG, RETAILER_PASSWORD (min 8 chars),
//        RETAILER_PHONE (optional, default 9000000001)
import { env, runScript } from "./_shared.js";
import { Company } from "../src/server/models/Company.js";
import { Customer } from "../src/server/models/Customer.js";
import { User } from "../src/server/models/User.js";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/server/auth/password.js";
import { ROLES } from "../src/lib/constants.js";
import { normalizePhone } from "../src/lib/phone.js";

if (process.env.NODE_ENV === "production") {
  console.error("✘ Refusing to create demo data with NODE_ENV=production.");
  process.exit(1);
}

const slug = env("DEFAULT_COMPANY_SLUG").toLowerCase();
const password = env("RETAILER_PASSWORD");
const phone = normalizePhone(env("RETAILER_PHONE", { required: false }) ?? "9000000001");

if (!phone) {
  console.error("✘ RETAILER_PHONE is not a valid 10-digit Indian mobile number.");
  process.exit(1);
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`✘ RETAILER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}

await runScript(async () => {
  const company = await Company.findOne({ slug });
  if (!company) throw new Error(`Company "${slug}" not found. Run "npm run admin:create" first.`);

  const customer = await Customer.findOneAndUpdate(
    { companyId: company._id, customerCode: "DEMO-001" },
    {
      $setOnInsert: {
        companyId: company._id,
        customerCode: "DEMO-001",
        shopName: "[DEMO] Sharma General Store",
        ownerName: "Demo Retailer",
        phone,
        shippingAddresses: [{ label: "Shop", line1: "Demo address", city: "Demo City", isDefault: true }],
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  const passwordHash = await hashPassword(password);
  const existing = await User.findOne({ companyId: company._id, phone });
  if (existing) {
    if (existing.role !== ROLES.RETAILER) throw new Error(`${phone} belongs to a non-retailer user.`);
    existing.set({ passwordHash, isActive: true, customerId: customer._id });
    existing.tokenVersion += 1;
    await existing.save();
    console.log(`✔ Reset demo retailer login ${phone}`);
  } else {
    await User.create({
      companyId: company._id,
      role: ROLES.RETAILER,
      name: "Demo Retailer",
      phone,
      customerId: customer._id,
      passwordHash,
    });
    console.log(`✔ Created demo retailer login ${phone} for "${customer.shopName}"`);
  }

  console.log("\nLog in at http://localhost:3000/login");
});
