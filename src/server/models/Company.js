import mongoose from "mongoose";
import { addressSchema, defineModel } from "./shared.js";

// A Company is a tenant: one distributor. Every other business record points
// to a company via companyId.
const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // URL-safe identifier, used to resolve the tenant at login
    // (from env in V1, from subdomain later: chandrika.yourapp.in).
    slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9-]{2,40}$/ },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gstin: { type: String, trim: true, uppercase: true },
    address: addressSchema,
    logoUrl: { type: String, trim: true },

    settings: {
      orderPrefix: { type: String, default: "ORD", uppercase: true, trim: true, match: /^[A-Z0-9]{1,6}$/ },
      allowNegativeStock: { type: Boolean, default: false },
      pricesIncludeGst: { type: Boolean, default: false },
      lowStockThreshold: { type: Number, default: 10, min: 0 },
      timezone: { type: String, default: "Asia/Kolkata" },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

companySchema.index({ slug: 1 }, { unique: true });

export const Company = defineModel("Company", companySchema);
