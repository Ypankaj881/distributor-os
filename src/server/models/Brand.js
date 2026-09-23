import mongoose from "mongoose";
import { ObjectId, defineModel } from "./shared.js";

// A brand/agency the distributor carries (Bellavita, Natraj, Apsara…).
const brandSchema = new mongoose.Schema(
  {
    companyId: { type: ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // Derived from name; the unique index on it stops duplicates like
    // "Natraj" and "natraj " within one company.
    slug: { type: String, required: true, trim: true, maxlength: 100 },
    logoUrl: { type: String, trim: true, default: "" },
    sortOrder: { type: Number, default: 0 }, // lower shows first on the retailer home
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null }, // soft delete
  },
  { timestamps: true },
);

brandSchema.index({ companyId: 1, slug: 1 }, { unique: true });
brandSchema.index({ companyId: 1, archivedAt: 1, sortOrder: 1, name: 1 });

export const Brand = defineModel("Brand", brandSchema);
