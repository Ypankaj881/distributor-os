// Verifies the MongoDB connection from the command line.
// Run: npm run db:check
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/server/db.js";

try {
  await connectDB();
  await mongoose.connection.db.admin().ping();
  const { host, name } = mongoose.connection;
  console.log(`✔ Connected to MongoDB — host: ${host}, database: ${name}`);
} catch (err) {
  console.error("✘ Could not connect to MongoDB:\n ", err.message);
  console.error("\nChecklist:");
  console.error("  1. Password in MONGODB_URI (.env.local) is correct and URL-encoded (@ → %40, # → %23).");
  console.error("  2. Atlas → Network Access allows your current IP address.");
  console.error("  3. Atlas → Database Access: the user exists and has readWrite permission.");
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
