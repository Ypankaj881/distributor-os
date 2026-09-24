import mongoose from "mongoose";
import { connectDB } from "@/server/db";
import { ok, fail } from "@/server/http/response";

// GET /api/health — confirms the app is up and can reach MongoDB.
// Used for setup checks and uptime monitoring.
//
// On failure it returns a short REASON CATEGORY (never values or secrets), so a
// broken deployment can be diagnosed without digging through logs:
//   MISSING_ENV:<NAME>  a required environment variable isn't set in this deployment
//   PLACEHOLDER_IN_URI  MONGODB_URI still contains a <placeholder>
//   BAD_URI             MONGODB_URI isn't a valid connection string (quotes, spaces, "MONGODB_URI=" prefix…)
//   AUTH_FAILED         wrong database username/password
//   NETWORK             database unreachable (Atlas Network Access, DNS, cluster down)
// Names only — never values.
const REQUIRED_ENV = ["MONGODB_URI", "MONGODB_DB", "AUTH_SECRET", "DEFAULT_COMPANY_SLUG"];

function reasonFor(err) {
  const msg = String(err?.message ?? "");
  if (/Missing required environment variable/.test(msg)) {
    const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
    return `MISSING_ENV:${missing.join(",") || "?"}`;
  }
  if (/placeholder/i.test(msg)) return "PLACEHOLDER_IN_URI";
  if (err?.name === "MongoParseError" || /Invalid scheme|URI|malformed|querySrv ENOTFOUND/i.test(msg)) return "BAD_URI";
  if (/auth|authentication failed/i.test(msg) || err?.code === 8000 || err?.code === 18) return "AUTH_FAILED";
  if (/ServerSelection|ECONNREFUSED|ETIMEDOUT|Could not connect/i.test(`${err?.name} ${msg}`)) return "NETWORK";
  return "UNKNOWN";
}

export async function GET() {
  try {
    await connectDB();
    await mongoose.connection.db.admin().ping();
    return ok({ status: "ok", db: "connected" });
  } catch (err) {
    const reason = reasonFor(err);
    console.error(`[health] Database check failed (${reason}):`, err.message);
    return fail({ status: 503, code: "DB_UNAVAILABLE", message: "Database is not reachable.", fields: { reason } });
  }
}
