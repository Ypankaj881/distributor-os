import Link from "next/link";
import { cn } from "@/components/ui/cn";

const TABS = [
  { key: "open", label: "Open" },
  { key: "NEW", label: "New" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PACKED", label: "Packed" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "closed", label: "Cancelled" },
  { key: "all", label: "All" },
];

// Status tabs with counts. "Open" = everything not yet delivered/cancelled —
// the distributor's working list.
export default function OrderStatusTabs({ active, counts, q, payment, customerId }) {
  const countFor = (key) => (key === "closed" ? (counts.CANCELLED ?? 0) + (counts.REJECTED ?? 0) : (counts[key] ?? 0));
  const href = (key) => {
    const sp = new URLSearchParams();
    if (key !== "open") sp.set("status", key);
    if (q) sp.set("q", q);
    if (payment) sp.set("payment", payment);
    if (customerId) sp.set("customerId", customerId);
    return sp.toString() ? `/admin/orders?${sp}` : "/admin/orders";
  };

  return (
    <nav aria-label="Order status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
      <ul className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const isActive = active === t.key;
          const n = countFor(t.key);
          return (
            <li key={t.key}>
              <Link
                href={href(t.key)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium",
                  isActive ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {t.label}
                <span className={cn("rounded-full px-1.5 text-xs", t.key === "NEW" && n > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")}>{n}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
