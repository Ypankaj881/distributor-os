import { ORDER_STATUS, ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/components/ui/cn";

const HAPPY_PATH = [ORDER_STATUS.NEW, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PACKED, ORDER_STATUS.DISPATCHED, ORDER_STATUS.DELIVERED];
const STEP_LABEL = { NEW: "Order placed", CONFIRMED: "Confirmed", PACKED: "Packed", DISPATCHED: "Dispatched", DELIVERED: "Delivered" };

// Vertical progress: placed → confirmed → packed → dispatched → delivered,
// with the time each step happened. Cancelled/rejected orders show where they
// stopped. Used by both the shop and (later) the admin order screens.
export default function OrderTimeline({ status, timeline, timeZone, showActor = false }) {
  const when = Object.fromEntries(timeline.map((t) => [t.status, t])); // latest entry per status
  const stopped = status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.REJECTED;
  const reached = stopped
    ? HAPPY_PATH.filter((s) => when[s])
    : HAPPY_PATH.slice(0, HAPPY_PATH.indexOf(status) + 1);
  const steps = stopped ? [...reached, status] : HAPPY_PATH;

  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const entry = when[s];
        const done = Boolean(entry) && (reached.includes(s) || s === status);
        const current = s === status;
        const bad = s === ORDER_STATUS.CANCELLED || s === ORDER_STATUS.REJECTED;
        const last = i === steps.length - 1;
        return (
          <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className={cn("absolute left-[9px] top-5 h-full w-0.5", done ? "bg-brand-500" : "bg-slate-200")} aria-hidden="true" />}
            <span
              className={cn(
                "relative z-10 mt-0.5 size-5 shrink-0 rounded-full border-2",
                bad ? "border-red-500 bg-red-500" : done ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-white",
                current && !bad && "ring-4 ring-brand-100",
              )}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", done || bad ? "text-slate-900" : "text-slate-400")}>
                {STEP_LABEL[s] ?? ORDER_STATUS_LABELS[s]}
              </p>
              {entry && (
                <p className="text-xs text-slate-500">
                  {formatDateTime(entry.at, timeZone)}
                  {showActor && entry.by ? ` · ${entry.by}` : ""}
                </p>
              )}
              {entry?.note && entry.note !== "Order placed" && <p className="mt-0.5 text-sm text-slate-600">{entry.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
