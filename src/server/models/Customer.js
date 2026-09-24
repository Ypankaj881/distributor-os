import mongoose from "mongoose";
import { ObjectId, addressSchema, defineModel } from "./shared.js";

// A Customer is a retail shop that buys from the distributor.
// Its login lives in User (role RETAILER, customerId → this document).
const shippingAddressSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 40, default: "Shop" },
  ...addressSchema.obj,
  isDefault: { type: Boolean, default: false },
});

const customerSchema = new mongoose.Schema(
  {
    companyId: { type: ObjectId, ref: "Company", required: true },
    customerCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    shopName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerName: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/ },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    gstin: { type: String, trim: true, uppercase: true, maxlength: 15 },
    billingAddress: addressSchema,
    shippingAddresses: [shippingAddressSchema],
    creditLimit: { type: Number, default: 0, min: 0 }, // paise; informational in V1
    paymentTerms: { type: String, trim: true, maxlength: 60 }, // e.g. "15 days credit"
    // Days after delivery before payment is due. null = use the company default.
    creditDays: { type: Number, min: 0, max: 365, default: null },
    notes: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
    // "shop owner phone code city", lowercased. Maintained by customerService.
    searchText: { type: String, default: "" },
  },
  { timestamps: true },
);

customerSchema.index({ companyId: 1, customerCode: 1 }, { unique: true });
customerSchema.index({ companyId: 1, phone: 1 });
customerSchema.index({ companyId: 1, isActive: 1, shopName: 1 });

export const Customer = defineModel("Customer", customerSchema);
