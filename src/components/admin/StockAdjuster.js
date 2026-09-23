"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Alert from "@/components/ui/Alert";
import StockBadge from "./StockBadge";
import { api } from "@/lib/apiClient";

// Stock is changed by adding/removing a quantity, never by typing a new total.
// The server applies it atomically, so it can't overwrite a simultaneous
// change (e.g. an order being confirmed at the same moment).
export default function StockAdjuster({ productId, stockQuantity, unit, threshold }) {
  const router = useRouter();
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  async function adjust(direction) {
    const n = Number(qty);
    if (!Number.isInteger(n) || n <= 0) {
      setMessage({ tone: "error", text: "Enter a whole number greater than 0." });
      return;
    }
    setBusy(direction);
    setMessage(null);
    const res = await api.post(`/api/admin/products/${productId}/stock`, { change: direction === "add" ? n : -n });
    setBusy(null);
    if (!res.ok) return setMessage({ tone: "error", text: res.error.message });
    setQty("");
    setMessage({ tone: "success", text: `Stock is now ${res.data.stockQuantity} ${unit}.` });
    router.refresh();
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Stock</h2>
        <StockBadge quantity={stockQuantity} threshold={threshold} unit={unit} />
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Input label={`Quantity (${unit})`} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 50" />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => adjust("add")} loading={busy === "add"} disabled={Boolean(busy)}>Add stock</Button>
        <Button variant="secondary" onClick={() => adjust("remove")} loading={busy === "remove"} disabled={Boolean(busy)}>Remove</Button>
      </div>
      <p className="text-xs text-slate-500">Use &quot;Add&quot; when goods arrive and &quot;Remove&quot; for damage or count corrections. Confirmed orders will deduct stock automatically.</p>
    </Card>
  );
}
