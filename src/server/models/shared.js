import mongoose from "mongoose";

// Registers a model. In development, hot reload re-runs model files: we drop
// the previously compiled model so schema edits take effect immediately
// (reusing it would keep the OLD schema and silently ignore new fields).
export function defineModel(name, schema) {
  if (mongoose.models[name]) {
    if (process.env.NODE_ENV === "production") return mongoose.models[name];
    mongoose.deleteModel(name);
  }
  return mongoose.model(name, schema);
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
