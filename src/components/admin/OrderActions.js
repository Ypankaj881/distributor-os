"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Textarea from "@/components/ui/Textarea";
import { api } from "@/lib/apiClient";
import { ORDER_STATUS } from "@/lib/constants";

const FORWARD_LABEL = {
  PACKED: "Mark as packed",
  DISPATCHED: "Mark as dispatched",
  DELIVERED: "Mark as delivered",
};
const NEEDS_REASON = [ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED];

// Status buttons. Only the transitions the server allows for the current
// status are shown (order.nextStatuses); the server checks again anyway.
export default function OrderActions({ order }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const forward = order.nextStatuses.filter((s) => FORWARD_LABEL[s]);
  const stop = order.nextStatuses.filter((s) => NEEDS_REASON.includes(s));
  if (!forward.length && !stop.length) return null;

  async function change(status) {
    setError(null);
    if (NEEDS_REASON.includes(status)) {
      if (note.trim().length < 3) return setError("Write a reason in the note box — the shop will see it.");
      const stockMsg = order.stockDeducted ? " The confirmed quantities will be added back to stock." : "";
      if (!window.confirm(`${status === ORDER_STATUS.REJECTED ? "Reject" : "Cancel"} order ${order.orderNumber}?${stockMsg}`)) return;
    }
    setBusy(status);
    const res = await api.patch(`/api/admin/orders/${order.id}/status`, { status, note });
    setBusy(null);
    if (!res.ok) return setError(res.error.fields?.note ?? res.error.message);
    setNote("");
    router.refresh();
  }

  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold">Update status</h2>
      <Textarea
        label="Note (optional; required to cancel/reject)"
        rows={2}
        maxLength={400}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Sent with Ramesh, vehicle MH-31 AB 1234"
      />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-2">
        {forward.map((s) => (
          <Button key={s} size="lg" onClick={() => change(s)} loading={busy === s} disabled={Boolean(busy)}>{FORWARD_LABEL[s]}</Button>
        ))}
        {stop.map((s) => (
          <Button key={s} variant="dangerGhost" onClick={() => change(s)} loading={busy === s} disabled={Boolean(busy)}>
            {s === ORDER_STATUS.REJECTED ? "Reject order" : "Cancel order"}
          </Button>
        ))}
      </div>
    </Card>
  );
}
