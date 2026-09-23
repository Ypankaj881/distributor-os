import mongoose from "mongoose";
import { GST_RATES } from "../../lib/constants.js";
import { ObjectId, defineModel } from "./shared.js";

const integer = { validator: Number.isInteger, message: "{PATH} must be a whole number." };

const productSchema = new mongoose.Schema(
  {
    companyId: { type: ObjectId, ref: "Company", required: true },
    brandId: { type: ObjectId, ref: "Brand", required: true },

    name: { type: String, required: true, trim: true, maxlength: 150 },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    imageUrl: { type: String, trim: true, default: "" },

    // The SELLING unit: what one "quantity" means in an order (box, piece…).
    unit: { type: String, required: true, trim: true, lowercase: true, maxlength: 20, default: "piece" },
    // Informational: items inside one unit, e.g. 10 → "Box of 10".
    packSize: { type: Number, min: 1, default: null, validate: { validator: (v) => v == null || Number.isInteger(v) } },

    // Money in integer paise (see src/lib/money.js). mrp 0 = not printed/not applicable.
    mrp: { type: Number, min: 0, default: 0, validate: integer },
    defaultPrice: { type: Number, required: true, min: 0, validate: integer },
    gstRate: { type: Number, default: 18, validate: { validator: (v) => GST_RATES.includes(v), message: "Invalid GST rate." } },
    hsnCode: { type: String, trim: true, maxlength: 8, default: "" },

    minOrderQty: { type: Number, min: 1, default: 1, validate: integer },
    // Changed ONLY through atomic $inc (stock adjustments, order confirmation)
    // so two simultaneous changes can never overwrite each other.
    stockQuantity: { type: Number, default: 0, validate: integer },

    isActive: { type: Boolean, default: true }, // inactive = hidden from retailers
    archivedAt: { type: Date, default: null }, // soft delete: kept for order history

    // Lowercased "name + sku + brand" used for search. Maintained by productService.
    searchText: { type: String, default: "" },
  },
  { timestamps: true },
);

// SKU is unique within a company — two distributors can both have "HB-01".
productSchema.index({ companyId: 1, sku: 1 }, { unique: true });
// Supports the common listings: by company (+ brand) (+ active), sorted by name.
productSchema.index({ companyId: 1, archivedAt: 1, brandId: 1, isActive: 1, name: 1 });
productSchema.index({ companyId: 1, archivedAt: 1, isActive: 1, name: 1 });

export const Product = defineModel("Product", productSchema);
