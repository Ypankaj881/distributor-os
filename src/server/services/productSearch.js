import { normalizeSearch } from "../utils.js";

// The single definition of what a product search can match on:
// its name, its SKU (with and without punctuation, so "BV-CEO" and "bvceo"
// both work) and its brand name.
export function buildProductSearchText({ name, sku, brandName }) {
  const compactSku = String(sku ?? "").replace(/[^a-z0-9]/gi, "");
  return normalizeSearch(`${name} ${sku} ${compactSku} ${brandName ?? ""}`);
}
