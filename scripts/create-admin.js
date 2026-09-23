// Creates the company (if it doesn't exist) and creates OR resets an admin user.
//
// Reads (from the terminal environment or .env.local):
//   DEFAULT_COMPANY_SLUG  company to create/use, e.g. "chandrika"
//   COMPANY_NAME          only needed the first time, when the company is created
//   ADMIN_EMAIL           admin login email
//   ADMIN_PASSWORD        at least 8 characters
//   ADMIN_NAME            optional, defaults to "Admin"
//   ADMIN_PHONE           optional 10-digit mobile (lets the admin log in by phone too)
//
// Running it again for the same email resets that admin's password and logs
// them out of every device.
import { env, runScript } from "./_shared.js";
import { Company } from "../src/server/models/Company.js";
import { User } from "../src/server/models/User.js";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/server/auth/password.js";
import { ROLES } from "../src/lib/constants.js";
import { normalizePhone } from "../src/lib/phone.js";

const slug = env("DEFAULT_COMPANY_SLUG").toLowerCase();
const email = env("ADMIN_EMAIL").toLowerCase();
const password = env("ADMIN_PASSWORD");
const name = env("ADMIN_NAME", { required: false }) ?? "Admin";
const rawPhone = env("ADMIN_PHONE", { required: false });

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("✘ ADMIN_EMAIL is not a valid email address.");
  process.exit(1);
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`✘ ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}
const phone = rawPhone ? normalizePhone(rawPhone) : undefined;
if (rawPhone && !phone) {
  console.error("✘ ADMIN_PHONE is not a valid 10-digit Indian mobile number.");
  process.exit(1);
}

await runScript(async () => {
  let company = await Company.findOne({ slug });
  if (!company) {
    const companyName = env("COMPANY_NAME");
    company = await Company.create({ name: companyName, slug });
    console.log(`✔ Created company "${company.name}" (slug: ${slug})`);
  } else {
    console.log(`• Using existing company "${company.name}" (slug: ${slug})`);
  }

  const passwordHash = await hashPassword(password);
  const existing = await User.findOne({ companyId: company._id, email });

  if (existing) {
    if (existing.role !== ROLES.ADMIN) throw new Error(`${email} belongs to a non-admin user.`);
    existing.set({ name, passwordHash, isActive: true, ...(phone && { phone }) });
    existing.tokenVersion += 1; // log out all existing sessions
    await existing.save();
    console.log(`✔ Reset admin ${email} — password updated, all old sessions logged out.`);
  } else {
    await User.create({ companyId: company._id, role: ROLES.ADMIN, name, email, phone, passwordHash });
    console.log(`✔ Created admin ${email}`);
  }

  console.log("\nLog in at http://localhost:3000/admin/login");
});
