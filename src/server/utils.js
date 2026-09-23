import mongoose from "mongoose";
import { Errors } from "./http/errors.js";

// Escapes user input before putting it inside a RegExp, so "C++" or ".*"
// is searched literally instead of being treated as a pattern.
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Lowercase, punctuation → spaces, collapse whitespace. Keeps Devanagari so
// Hindi product names can be searched later.
export function normalizeSearch(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// "Bella ceo" → ["bella", "ceo"]. Capped so a huge query can't build a huge filter.
export function searchTokens(query) {
  return normalizeSearch(query).split(" ").filter(Boolean).slice(0, 6);
}

// Every token must appear somewhere in `field` (AND search, any order).
export function tokenSearchFilter(field, query) {
  const tokens = searchTokens(query);
  return tokens.length ? { $and: tokens.map((t) => ({ [field]: { $regex: escapeRegex(t) } })) } : {};
}

// Invalid ids are answered with 404 (not 400/500): to the caller, a malformed
// id and a non-existent one are the same thing — "no such record".
export function assertObjectId(id, what = "Record") {
  if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id) || !mongoose.isValidObjectId(id)) {
    throw Errors.notFound(what);
  }
}

export function pageMeta(page, limit, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export const toId = (value) => (value == null ? null : String(value));
export const toIso = (date) => (date ? new Date(date).toISOString() : null);
