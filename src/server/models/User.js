import mongoose from "mongoose";
import { ROLES } from "../../lib/constants.js";
import { ObjectId, defineModel } from "./shared.js";

// A User is a LOGIN identity (who can sign in). It is deliberately separate
// from Customer (the shop as a business). Today one shop = one login, but this
// lets a shop have several logins later (owner + staff) without reshaping data.
const userSchema = new mongoose.Schema(
  {
    companyId: { type: ObjectId, ref: "Company", required: true },
    role: { type: String, enum: Object.values(ROLES), required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, match: /^[6-9]\d{9}$/ },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },

    // select:false → never returned by queries unless explicitly requested
    // with .select("+passwordHash"). Prevents accidental leaks in API responses.
    passwordHash: { type: String, required: true, select: false },

    // Set only for RETAILER users: the shop this login belongs to.
    customerId: { type: ObjectId, ref: "Customer" },

    isActive: { type: Boolean, default: true },
    // Incrementing this invalidates every existing session for the user
    // (used on password reset and deactivation).
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

// Unique phone/email PER COMPANY (compound index). The same shopkeeper could
// have accounts with two different distributors in the future.
// partialFilterExpression: uniqueness only applies when the field is set,
// so many users may have no email.
userSchema.index(
  { companyId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
);
userSchema.index(
  { companyId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
userSchema.index({ companyId: 1, customerId: 1 });

userSchema.pre("validate", function () {
  if (!this.phone && !this.email) {
    this.invalidate("phone", "A phone number or email is required.");
  }
  if (this.role === ROLES.RETAILER && !this.customerId) {
    this.invalidate("customerId", "Retailer users must be linked to a customer.");
  }
});

export const User = defineModel("User", userSchema);
