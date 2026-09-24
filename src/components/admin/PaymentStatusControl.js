"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";

const OPTIONS = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIAL", label: "Partly paid" },
  { value: "PAID", label: "Paid" },
];

// Manual record of payment (cash/UPI collected offline). No online payments in V1.
export default function PaymentStatusControl({ orderId, value }) {
  const router = useRouter();
  const [status, setStatus] = useState(value);
  const [state, setState] = useState(null);

  async function change(next) {
    const prev = status;
    setStatus(next);
    setState("saving");
    const res = await api.patch(`/api/admin/orders/${orderId}/payment`, { paymentStatus: next });
    if (!res.ok) {
      setStatus(prev);
      setState("error");
      return;
    }
    setState("saved");
    router.refresh();
  }

  return (
    <div>
      <label htmlFor="payment-status" className="mb-1.5 block text-sm font-medium text-slate-700">Payment</label>
      <select
        id="payment-status"
        value={status}
        onChange={(e) => change(e.target.value)}
        disabled={state === "saving"}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      >
        {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <p className="mt-1 h-4 text-xs text-slate-500">
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? <span className="text-red-600">Couldn&apos;t save. Try again.</span> : ""}
      </p>
    </div>
  );
}
