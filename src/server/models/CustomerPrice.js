import mongoose from "mongoose";
import { ObjectId, defineModel } from "./shared.js";

// A special price for ONE shop on ONE product, valid for a period.
// Records are never overwritten: a new price is a new record, so the history
// of what a shop was charged when is preserved.
//
// Which record applies at time T? (see pricingService.pickApplicable)
//   isActive AND effectiveFrom <= T AND (effectiveTo is null OR effectiveTo > T)
//   → if several match, the one with the LATEST effectiveFrom wins.
//   → if none match, the product's defaultPrice applies.
const customerPriceSchema = new mongoose.Schema(
  {
    companyId: { type: ObjectId, ref: "Company", required: true },
    customerId: { type: ObjectId, ref: "Customer", required: true },
    productId: { type: ObjectId, ref: "Product", required: true },
    price: { type: Number, required: true, min: 1, validate: Number.isInteger }, // paise, before GST
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null }, // exclusive; null = open-ended
    isActive: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: "User" },
    updatedBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Main lookup: "prices for this shop for these products", newest first.
customerPriceSchema.index({ companyId: 1, customerId: 1, productId: 1, effectiveFrom: -1 });
// Reverse lookup for later: "which shops have a special price on this product".
customerPriceSchema.index({ companyId: 1, productId: 1 });

export const CustomerPrice = defineModel("CustomerPrice", customerPriceSchema);
