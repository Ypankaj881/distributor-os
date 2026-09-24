"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Textarea from "@/components/ui/Textarea";
import { api } from "@/lib/apiClient";
import { formatINR } from "@/lib/money";
import { splitGst } from "@/lib/tax";
import { cn } from "@/components/ui/cn";

// Confirming a NEW order: the admin sees what was ordered next to current
// stock, can lower quantities (partial supply), then confirms. The server
// deducts stock for the confirmed quantities in one transaction.
// Totals shown here are a PREVIEW; the server recalculates them.
export default function ConfirmOrderPanel({ order }) {
  const router = useRouter();
  const [qty, setQty] = useState(() => Object.fromEntries(order.items.map((i) => [i.id, String(i.orderedQty)])));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const n = (id) => {
    const v = parseInt(qty[id], 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  const preview = order.items.reduce(
    (t, i) => {
      const s = splitGst(i.unitPrice * n(i.id), i.gstRate, order.pricesIncludeGst);
      return { taxable: t.taxable + s.taxable, gst: t.gst + s.gst, total: t.total + s.total };
    },
    { taxable: 0, gst: 0, total: 0 },
  );
  const shortItems = order.items.filter((i) => i.currentStock != null && n(i.id) > i.currentStock);
  const changedCount = order.items.filter((i) => n(i.id) !== i.orderedQty).length;

  function fitToStock() {
    setQty(Object.fromEntries(order.items.map((i) => [i.id, String(Math.min(i.orderedQty, Math.max(i.currentStock ?? i.orderedQty, 0)))])));
    setErrors({});
  }

  async function confirm() {
    const local = {};
    for (const i of order.items) {
      const v = parseInt(qty[i.id], 10);
      if (!Number.isFinite(v) || v < 0) local[i.id] = "Enter 0 or more.";
      else if (v > i.orderedQty) local[i.id] = `Max ${i.orderedQty} (ordered).`;
    }
    if (Object.keys(local).length) return setErrors(local);
    if (changedCount > 0 && !window.confirm(`${changedCount} item(s) will be supplied in a smaller quantity. The shop will see this. Confirm?`)) return;

    setSaving(true);
    setMessage(null);
    const res = await api.post(`/api/admin/orders/${order.id}/confirm`, {
      quantities: order.items.map((i) => ({ itemId: i.id, confirmedQty: n(i.id) })),
      note,
    });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.error.fields ?? {});
      setMessage(res.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="font-semibold">Confirm order</h2>
          <p className="text-sm text-slate-500">Lower a quantity if you can&apos;t supply all of it. Stock is deducted when you confirm.</p>
        </div>
        {shortItems.length > 0 && <Button size="sm" variant="secondary" onClick={fitToStock}>Fit to available stock</Button>}
      </div>

      <div className="hidden grid-cols-[1fr_90px_90px_110px_110px] gap-3 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
        <span>Product</span><span className="text-right">Ordered</span><span className="text-right">In stock</span><span>Confirm qty</span><span className="text-right">Amount</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {order.items.map((i) => {
          const q = n(i.id);
          const short = i.currentStock != null && q > i.currentStock;
          const line = splitGst(i.unitPrice * q, i.gstRate, order.pricesIncludeGst);
          return (
            <li key={i.id} className="grid grid-cols-2 gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_90px_90px_110px_110px] md:items-center">
              <div className="col-span-2 min-w-0 md:col-span-1">
                <p className="font-medium">{i.name}</p>
                <p className="text-xs text-slate-500">{i.brandName} · <span className="font-mono">{i.sku}</span> · {formatINR(i.unitPrice)}/{i.unit}</p>
              </div>
              <p className="tabular-nums md:text-right"><span className="text-slate-500 md:hidden">Ordered: </span>{i.orderedQty} {i.unit}</p>
              <p className={cn("tabular-nums md:text-right", short ? "font-semibold text-red-600" : "text-slate-600")}>
                <span className="font-normal text-slate-500 md:hidden">In stock: </span>{i.currentStock ?? "—"}
              </p>
              <div>
                <input
                  inputMode="numeric"
                  aria-label={`Confirm quantity for ${i.name}`}
                  value={qty[i.id]}
                  onChange={(e) => { setQty((s) => ({ ...s, [i.id]: e.target.value.replace(/\D/g, "") })); setErrors((er) => ({ ...er, [i.id]: undefined })); }}
                  className={cn(
                    "h-10 w-24 rounded-lg border px-3 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500/30",
                    errors[i.id] || short ? "border-red-400" : q !== i.orderedQty ? "border-amber-400 bg-amber-50" : "border-slate-300",
                  )}
                />
                {errors[i.id] && <p className="mt-1 text-xs text-red-600">{errors[i.id]}</p>}
              </div>
              <p className="text-right font-medium tabular-nums">{formatINR(line.taxable)}</p>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-4">
        <dl className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{formatINR(preview.taxable)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">GST</dt><dd className="tabular-nums">{formatINR(preview.gst)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>Total after confirmation</dt><dd className="tabular-nums">{formatINR(preview.total)}</dd></div>
        </dl>
        <Textarea label="Note to the shop (optional)" rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Remaining 5 boxes will come next week" />
        {message && <Alert tone="error">{message}</Alert>}
        {shortItems.length > 0 && !message && <Alert tone="warning">{shortItems.length} item(s) need more stock than available. Lower the quantity or add stock first.</Alert>}
        <Button size="lg" className="w-full sm:w-auto" onClick={confirm} loading={saving}>Confirm order{changedCount ? ` (${changedCount} changed)` : ""}</Button>
      </div>
    </Card>
  );
}
