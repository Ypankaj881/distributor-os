import { connectDB } from "../db.js";
import { Company } from "../models/Company.js";
import { Errors } from "../http/errors.js";

const ADDRESS_KEYS = ["line1", "line2", "landmark", "city", "state", "pincode"];

function toSettingsDTO(c) {
  return {
    name: c.name,
    slug: c.slug,
    phone: c.phone ?? "",
    email: c.email ?? "",
    gstin: c.gstin ?? "",
    address: Object.fromEntries(ADDRESS_KEYS.map((k) => [k, c.address?.[k] ?? ""])),
    settings: {
      orderPrefix: c.settings?.orderPrefix ?? "ORD",
      pricesIncludeGst: Boolean(c.settings?.pricesIncludeGst),
      allowNegativeStock: Boolean(c.settings?.allowNegativeStock),
      lowStockThreshold: c.settings?.lowStockThreshold ?? 10,
      defaultCreditDays: c.settings?.defaultCreditDays ?? 0,
      timezone: c.settings?.timezone ?? "Asia/Kolkata",
    },
  };
}

export async function getCompanySettings(companyId) {
  await connectDB();
  const company = await Company.findById(companyId).lean();
  if (!company) throw Errors.notFound("Company");
  return toSettingsDTO(company);
}

// Partial update. Nested objects are written field-by-field ("settings.orderPrefix")
// so changing one setting never wipes the others.
export async function updateCompanySettings(companyId, patch) {
  await connectDB();
  const $set = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "settings" || key === "address") {
      for (const [k, v] of Object.entries(value)) $set[`${key}.${k}`] = v;
    } else {
      $set[key] = value;
    }
  }
  const company = await Company.findOneAndUpdate({ _id: companyId }, { $set }, { returnDocument: "after", runValidators: true }).lean();
  if (!company) throw Errors.notFound("Company");
  return toSettingsDTO(company);
}
