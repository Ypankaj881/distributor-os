"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Textarea from "@/components/ui/Textarea";
import { useCart } from "./CartProvider";
import { api } from "@/lib/apiClient";
import { formatINR } from "@/lib/money";
import { newUuid } from "@/lib/uuid";
import { cn } from "@/components/ui/cn";

const EMPTY_CART = {
  lines: [],
  totals: { lineCount: 0, unitCount: 0, subtotal: 0, gst: 0, total: 0 },
  canCheckout: false,
  pricesIncludeGst: false,
};

function formatAddress(a) {
  return [a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", ");
}

// Duplicate-order protection, two layers:
//  1. The button is disabled while the request is in flight (stops double taps).
//  2. An idempotency key is created ONCE for this checkout and sent with every
//     attempt. If the network drops after the server created the order and the
//     shop taps again, the server recognises the key and returns the SAME
//     order instead of creating a second one.
export default function CheckoutForm({ view, addresses }) {
  const router = useRouter();
  const { replaceCart } = useCart();
  const keyRef = useRef(null);
  const [addressId, setAddressId] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);

  async function placeOrder() {
    if (placing) return;
    setPlacing(true);
    setError(null);
    keyRef.current ??= newUuid();

    const res = await api.post("/api/shop/orders", {
      idempotencyKey: keyRef.current,
      ...(addressId && { addressId }),
      notes,
      expectedTotal: view.totals.total,
    });

    if (res.ok) {
      replaceCart({ ...EMPTY_CART, pricesIncludeGst: view.pricesIncludeGst });
      router.replace(`/orders/${res.data.order.id}/placed`);
      return; // keep the button disabled while navigating
    }

    setPlacing(false);
    const code = res.error.code;
    if (code === "NETWORK_ERROR") {
      setError("Connection problem. Please tap Place order again — your order will not be placed twice.");
    } else if (code === "PRICE_CHANGED") {
      setError(res.error.message);
      router.refresh(); // reload the latest prices into this page
    } else if (code === "CART_HAS_ISSUES" || code === "CART_EMPTY") {
      router.replace("/cart");
    } else {
      setError(res.error.fields?.addressId ?? res.error.message);
    }
  }

  const { totals } = view;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="space-y-4">
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Deliver to</h2>
          {addresses.length === 0 ? (
            <p className="text-sm text-slate-500">No delivery address on file. The distributor will contact you to confirm delivery.</p>
          ) : (
            <div className="space-y-2" role="radiogroup" aria-label="Delivery address">
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3",
                    addressId === a.id ? "border-brand-500 bg-brand-50/50" : "border-slate-200",
                  )}
                >
                  <input type="radio" name="address" className="mt-1 size-4 accent-brand-600" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <span className="text-sm">
                    <span className="font-medium">{a.label}</span>
                    <span className="block text-slate-600">{formatAddress(a) || "Address not filled in"}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Order summary</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {view.lines.map((l) => (
              <li key={l.productId} className="flex justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="line-clamp-1 font-medium">{l.name}</span>
                  <span className="text-slate-500">{l.quantity} {l.unit} × {formatINR(l.price)}</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatINR(l.taxable)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <Textarea
            label="Note for the distributor (optional)"
            placeholder="e.g. Deliver before 5 pm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={2}
          />
        </Card>
      </div>

      <div className="safe-bottom sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 lg:top-20 lg:bottom-auto">
        <Card className="space-y-3 p-3 shadow-lg lg:p-4 lg:shadow-none">
          <dl className="hidden space-y-1 text-sm lg:block">
            <div className="flex justify-between"><dt className="text-slate-500">Items ({totals.unitCount})</dt><dd className="tabular-nums">{formatINR(totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">GST{view.pricesIncludeGst ? " (included)" : ""}</dt><dd className="tabular-nums">{formatINR(totals.gst)}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(totals.total)}</dd></div>
          </dl>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex items-center gap-3 lg:block">
            <div className="min-w-0 lg:hidden">
              <p className="text-xs text-slate-500">{totals.unitCount} items · GST {formatINR(totals.gst)}</p>
              <p className="text-lg font-semibold tabular-nums">{formatINR(totals.total)}</p>
            </div>
            <Button size="lg" className="flex-1 lg:w-full" onClick={placeOrder} loading={placing}>
              {placing ? "Placing…" : "Place order"}
            </Button>
          </div>
          <p className="hidden text-center text-xs text-slate-500 lg:block">No online payment. The distributor confirms your order and delivers.</p>
        </Card>
      </div>
    </div>
  );
}
