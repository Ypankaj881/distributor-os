import mongoose from "mongoose";
import { config } from "./config.js";

// A filter on a field that isn't in the schema THROWS instead of being silently
// dropped. Silently dropping it turns e.g. { companyID: x } (typo) into {} →
// "match everything", which could leak another company's data.
mongoose.set("strictQuery", "throw");

// In development Next.js reloads modules on every change, and on serverless each
// warm instance reuses module state. Caching the connection on globalThis means
// we open ONE connection pool per process instead of one per request/reload.
const cache = globalThis.__mongoose ?? (globalThis.__mongoose = { conn: null, promise: null });

export async function connectDB() {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const { uri, dbName } = config.mongo();
    cache.promise = mongoose
      .connect(uri, {
        dbName,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
      })
      .catch((err) => {
        // Allow the next request to retry instead of caching a failed promise.
        cache.promise = null;
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectDB() {
  if (cache.conn) {
    await mongoose.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
