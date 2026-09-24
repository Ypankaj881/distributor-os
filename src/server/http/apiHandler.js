import { ZodError } from "zod";
import { AppError, Errors } from "./errors.js";
import { fail } from "./response.js";

// Wraps a route handler with centralized error handling, so individual
// handlers only contain the happy path:
//
//   export const GET = withApi(async (req, ctx) => ok(await doThing()));
//
export function withApi(handler) {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

function toErrorResponse(err) {
  if (err instanceof AppError) {
    return fail(err);
  }

  if (err instanceof ZodError) {
    return fail(Errors.validation(zodFields(err)));
  }

  // Mongoose: malformed ObjectId in a URL or body.
  if (err?.name === "CastError") {
    return fail(Errors.badRequest(`Invalid value for ${err.path}.`));
  }

  // Mongoose schema validation (should be rare — zod validates first).
  if (err?.name === "ValidationError") {
    const fields = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    return fail(Errors.validation(fields));
  }

  // MongoDB unique index violation.
  if (err?.code === 11000) {
    const fields = Object.fromEntries(Object.keys(err.keyValue ?? {}).map((k) => [k, "Already exists."]));
    return fail(Errors.conflict("A record with these details already exists.", fields));
  }

  // Database unreachable (network blip, Atlas IP not allowed, cluster down).
  if (/MongooseServerSelectionError|MongoServerSelectionError|MongoNetworkError|MongoNetworkTimeoutError/.test(err?.name ?? "")) {
    console.error("[api] Database unavailable:", err.message);
    return fail({ status: 503, code: "SERVICE_UNAVAILABLE", message: "The service is temporarily unavailable. Please try again in a minute." });
  }

  // Unknown error: log the details server-side, tell the user nothing sensitive.
  console.error("[api] Unhandled error:", err);
  return fail({ status: 500, code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." });
}

function zodFields(err) {
  const fields = {};
  for (const issue of err.issues) {
    // .strict() schemas reject fields the client isn't allowed to send.
    if (issue.code === "unrecognized_keys") {
      for (const k of issue.keys) fields[[...issue.path, k].join(".")] = "This field can't be set here.";
      continue;
    }
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

const MAX_BODY_BYTES = 1_000_000; // 1 MB — far above any real request (a 200-line price update is ~20 KB)

// Parses a JSON body. Oversized bodies → 413, malformed JSON → 400.
export async function readJson(req) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new AppError("Request is too large.", { status: 413, code: "PAYLOAD_TOO_LARGE" });
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new AppError("Request is too large.", { status: 413, code: "PAYLOAD_TOO_LARGE" });
  try {
    return JSON.parse(text);
  } catch {
    throw Errors.badRequest("Request body must be valid JSON.");
  }
}
