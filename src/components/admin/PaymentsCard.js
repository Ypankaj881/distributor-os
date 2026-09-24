"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import { api } from "@/lib/apiClient";
import { formatINR, toPaise, fromPaise } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { paymentState } from "@/lib/payments";
import { PAYMENT_MODES } from "@/lib/constants";
import { cn } from "@/components/ui/cn";

const niceDate = (d) => (d ? formatDate(`${d}T12:00:00Z`, "UTC") : "");

// Payments for one order: summary (total / paid / balance / due date), the
// list of receipts, "Record payment" and "Void" (with a reason, kept in history).
export default function PaymentsCard({ order, today }) {
  const router = useRouter();
  const state = paymentState(order, today);
  const closed = state.key === "NA";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", mode: "CASH", paidOn: today, reference: "", note: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(null);
  const [voiding, setVoiding] = useState(null); // payment id
  const [voidReason, setVoidReason] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function startRecording() {
    setForm({ amount: String(fromPaise(state.balance)), mode: "CASH", paidOn: today, reference: "", note: "" });
    setErrors({});
    setMessage(null);
    setOpen(true);
  }

  async function save() {
    const amount = toPaise(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setErrors({ amount: "Enter the amount received." });
    setBusy("save");
    setErrors({});
    const res = await api.post(`/api/admin/orders/${order.id}/payments`, { ...form, amount });
    setBusy(null);
    if (!res.ok) {
      setErrors(res.error.fields ?? {});
      if (!res.error.fields) setMessage({ tone: "error", text: res.error.message });
      return;
    }
    setOpen(false);
    setMessage({ tone: "success", text: `${formatINR(amount)} recorded.` });
    router.refresh();
  }

  async function confirmVoid(paymentId) {
    setBusy(paymentId);
    const res = await api.post(`/api/admin/orders/${order.id}/payments/${paymentId}/void`, { reason: voidReason });
    setBusy(null);
    if (!res.ok) return setMessage({ tone: "error", text: res.error.fields?.reason ?? res.error.message });
    setVoiding(null);
    setVoidReason("");
    setMessage({ tone: "success", text: "Payment voided." });
    router.refresh();
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Payment</h2>
        {!closed && <Badge tone={state.tone}>{state.label}</Badge>}
      </div>

      {closed ? (
        <p className="text-sm text-slate-500">This order is {order.status.toLowerCase()} — nothing to collect.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-slate-500">Order total</dt><dd className="text-right tabular-nums">{formatINR(order.grandTotal)}</dd>
          <dt className="text-slate-500">Received</dt><dd className="text-right tabular-nums">{formatINR(state.paid)}</dd>
          <dt className="font-medium">Balance</dt><dd className={cn("text-right font-semibold tabular-nums", state.key === "OVERDUE" && "text-red-600")}>{formatINR(state.balance)}</dd>
          <dt className="text-slate-500">Due</dt>
          <dd className={cn("text-right", state.key === "OVERDUE" && "font-medium text-red-600")}>
            {state.dueOn
              ? `${niceDate(state.dueOn)}${order.creditDays != null ? (order.creditDays === 0 ? " (pay on delivery)" : ` (${order.creditDays} days credit)`) : ""}`
              : "When delivered"}
          </dd>
        </dl>
      )}

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {order.payments.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {order.payments.map((p) => (
            <li key={p.id} className={cn("space-y-1 p-3", p.voided && "bg-slate-50 text-slate-400")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={cn("font-medium tabular-nums", p.voided && "line-through")}>{formatINR(p.amount)} · {PAYMENT_MODES[p.mode] ?? p.mode}</p>
                  <p className="text-xs text-slate-500">
                    {niceDate(p.paidOn)}{p.reference && ` · Ref ${p.reference}`}{p.recordedByName && ` · by ${p.recordedByName}`}
                  </p>
                  {p.note && <p className="text-xs text-slate-500">{p.note}</p>}
                  {p.voided && <p className="text-xs text-red-600">Voided by {p.voidedByName}: {p.voidReason}</p>}
                </div>
                {!p.voided && voiding !== p.id && (
                  <button type="button" onClick={() => { setVoiding(p.id); setVoidReason(""); }} className="text-xs text-slate-400 hover:text-red-600">Void</button>
                )}
              </div>
              {voiding === p.id && (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="Reason (e.g. entered twice)"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-2 text-sm"
                  />
                  <Button size="sm" variant="danger" onClick={() => confirmVoid(p.id)} loading={busy === p.id}>Void</Button>
                  <Button size="sm" variant="ghost" onClick={() => setVoiding(null)}>Cancel</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!closed && state.balance > 0 && !open && <Button className="w-full" onClick={startRecording}>Record payment</Button>}

      {open && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (₹)" inputMode="decimal" value={form.amount} onChange={set("amount")} error={errors.amount} />
            <Select label="Paid by" value={form.mode} onChange={set("mode")} error={errors.mode}>
              {Object.entries(PAYMENT_MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Input label="Date" type="date" max={today} value={form.paidOn} onChange={set("paidOn")} error={errors.paidOn} />
            <Input label="Reference" value={form.reference} onChange={set("reference")} maxLength={100} placeholder="UPI ref / cheque no." />
          </div>
          <Input label="Note (optional)" value={form.note} onChange={set("note")} maxLength={300} />
          <div className="flex gap-2">
            <Button onClick={save} loading={busy === "save"}>Save payment</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
