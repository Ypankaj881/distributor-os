import mongoose from "mongoose";
import { ObjectId, defineModel } from "./shared.js";

// Per-company running numbers (customer codes now, order numbers in Phase 7).
// Incremented atomically with $inc, so two simultaneous requests can never get
// the same number.
const counterSchema = new mongoose.Schema({
  companyId: { type: ObjectId, ref: "Company", required: true },
  key: { type: String, required: true }, // "customer", "order"
  seq: { type: Number, default: 0 },
});

counterSchema.index({ companyId: 1, key: 1 }, { unique: true });

export const Counter = defineModel("Counter", counterSchema);

export async function nextSequence(companyId, key, { session } = {}) {
  const doc = await Counter.findOneAndUpdate(
    { companyId, key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  ).lean();
  return doc.seq;
}
