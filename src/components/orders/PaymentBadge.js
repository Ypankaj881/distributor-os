import Badge from "@/components/ui/Badge";
import { paymentState } from "@/lib/payments";
import { formatINR } from "@/lib/money";

// Paid / Partly paid / Unpaid / Overdue N days — derived, never stored.
// `today` ("YYYY-MM-DD" in the company timezone) comes from the server.
export default function PaymentBadge({ order, today, showBalance = false, className }) {
  const s = paymentState(order, today);
  if (s.key === "NA") return <Badge className={className}>—</Badge>;
  return (
    <span className={className}>
      <Badge tone={s.tone}>{s.label}</Badge>
      {showBalance && s.balance > 0 && s.key !== "UNPAID" && <span className="ml-1 text-xs text-slate-500">{formatINR(s.balance)} due</span>}
    </span>
  );
}
