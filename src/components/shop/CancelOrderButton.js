"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Textarea from "@/components/ui/Textarea";
import { api } from "@/lib/apiClient";

// Shops can cancel their own order only while it is still NEW (not yet
// confirmed by the distributor). The server enforces the same rule.
export default function CancelOrderButton({ orderId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await api.post(`/api/shop/orders/${orderId}/cancel`, { reason });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="dangerGhost" className="w-full" onClick={() => setOpen(true)}>
        Cancel order
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4">
      <p className="text-sm font-medium">Cancel this order?</p>
      <Textarea label="Reason (optional)" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ordered by mistake" />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Keep order</Button>
        <Button variant="danger" onClick={cancel} loading={busy}>Yes, cancel</Button>
      </div>
    </div>
  );
}
