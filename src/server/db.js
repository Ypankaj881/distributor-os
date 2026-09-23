import mongoose from "mongoose";
import { config } from "./config.js";

// Reject query filters on fields that aren't in the schema. This blocks a class
// of injection bugs where a request smuggles unexpected filter keys.
mongoose.set("strictQuery", true);

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
