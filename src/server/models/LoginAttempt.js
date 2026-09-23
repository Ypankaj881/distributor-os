import mongoose from "mongoose";
import { defineModel } from "./shared.js";

// One document per FAILED login. A TTL index makes MongoDB delete each document
// automatically 15 minutes after it was created, so the collection cleans itself.
// Stored in the database (not in memory) so limits hold across serverless instances.
const loginAttemptSchema = new mongoose.Schema({
  key: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 15 * 60 },
});

loginAttemptSchema.index({ key: 1, createdAt: -1 });

export const LoginAttempt = defineModel("LoginAttempt", loginAttemptSchema);
