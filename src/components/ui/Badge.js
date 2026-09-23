import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { cn } from "./cn";

const TONES = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};

export default function Badge({ tone = "gray", className, children }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONES = {
  NEW: "amber",
  CONFIRMED: "blue",
  PACKED: "violet",
  DISPATCHED: "violet",
  DELIVERED: "green",
  CANCELLED: "gray",
  REJECTED: "red",
};

export function StatusBadge({ status, className }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "gray"} className={className}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
