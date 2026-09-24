"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { useCart } from "./CartProvider";
import { api } from "@/lib/apiClient";
import { formatINR } from "@/lib/money";

// Puts a past order's products back in the cart at TODAY's prices and stock,
// then shows exactly what was added, changed or left out.
export default function ReorderButton({ orderId, size = "lg", variant = "primary", className }) {
  const { replaceCart } = useCart();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function reorder() {
    setBusy(true);
    setError(null);
    const res = await api.post(`/api/shop/orders/${orderId}/reorder`);
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    replaceCart(res.data.view);
    setResult(res.data);
  }

  if (result) {
    const { added, skipped } = result;
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-left">
        {added.length > 0 ? (
          <p className="font-medium text-emerald-700">Added {added.length} product{added.length === 1 ? "" : "s"} to your cart</p>
        ) : (
          <p className="font-medium text-slate-900">Nothing could be added</p>
        )}
        {added.some((a) => a.note || a.priceChange) && (
          <ul className="space-y-1 text-sm">
            {added.filter((a) => a.note || a.priceChange).map((a) => (
              <li key={a.productId}>
                <span className="font-medium">{a.name}</span>
                <span className="text-slate-600">
                  {a.note && ` — ${a.note}`}
                  {a.priceChange && ` — price now ${formatINR(a.priceChange.to)} (was ${formatINR(a.priceChange.from)})`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {skipped.length > 0 && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Not added:</p>
            <ul className="mt-1 space-y-0.5">
              {skipped.map((s, i) => (
                <li key={i}>{s.name} — {s.reason.toLowerCase()}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setResult(null)}>Close</Button>
          <Button href="/cart" disabled={added.length === 0}>View cart</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button size={size} variant={variant} className="w-full" onClick={reorder} loading={busy}>
        {busy ? "Adding to cart…" : "Reorder"}
      </Button>
      {error && <Alert tone="error" className="mt-2">{error}</Alert>}
    </div>
  );
}
