import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { ok, fail } from "@/server/http/response";

// GET /api/health — confirms the app is up and can reach MongoDB.
// Used for local setup checks now and uptime monitoring after deployment.
export async function GET() {
  try {
    await connectDB();
    await mongoose.connection.db.admin().ping();
    return ok({ status: "ok", db: "connected" });
  } catch (err) {
    console.error("[health] Database check failed:", err.message);
    return fail({ status: 503, code: "DB_UNAVAILABLE", message: "Database is not reachable." });
  }
}
