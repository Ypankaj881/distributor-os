// "in" | "low" | "out" — used for admin badges now and for the retailer's
// "In stock / Low stock / Out of stock" label later (never the exact number).
export function stockStatus(quantity, lowStockThreshold = 10) {
  if (quantity <= 0) return "out";
  if (quantity <= lowStockThreshold) return "low";
  return "in";
}

export const STOCK_LABELS = { in: "In stock", low: "Low stock", out: "Out of stock" };
