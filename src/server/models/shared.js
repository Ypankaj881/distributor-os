import mongoose from "mongoose";

// Re-registering a model during Next.js hot reload throws
// "OverwriteModelError", so reuse the compiled model when it already exists.
export function defineModel(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

export const { ObjectId } = mongoose.Schema.Types;

export const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    landmark: { type: String, trim: true, maxlength: 120 },
    city: { type: String, trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 80 },
    pincode: { type: String, trim: true, match: /^\d{6}$/ },
  },
  { _id: false },
);
