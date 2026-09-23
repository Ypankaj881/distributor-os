import mongoose from "mongoose";
import { ObjectId, defineModel } from "./shared.js";

// One cart per shop. It stores ONLY product + quantity — never prices or
// totals. Prices are resolved fresh every time the cart is shown or ordered,
// so a stale or tampered price can never reach an order.
const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const cartSchema = new mongoose.Schema(
  {
    companyId: { type: ObjectId, ref: "Company", required: true },
    customerId: { type: ObjectId, ref: "Customer", required: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

// Exactly one cart per shop per company.
cartSchema.index({ companyId: 1, customerId: 1 }, { unique: true });

export const Cart = defineModel("Cart", cartSchema);
