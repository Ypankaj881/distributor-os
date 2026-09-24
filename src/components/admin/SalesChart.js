import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";

// 14-day daily sales, single series → one color, no legend (the card title
// names it). Plain HTML/CSS, no chart library.
//  - bars grow from a shared baseline, 4px rounded tops, 2px gaps
//  - hover or keyboard-focus a bar for a tooltip (date, sales, orders)
//  - only today's value is labelled directly; the peak sets the scale label
//  - a visually hidden table gives screen readers the same data
function shortDate(isoDate) {
  return formatDate(`${isoDate}T12:00:00Z`, "UTC").replace(/ \d{4}$/, "");
}

export default function SalesChart({ days }) {
  const max = Math.max(...days.map((d) => d.sales), 0);
  const lastIndex = days.length - 1;

  if (max === 0) {
    return <p className="flex h-44 items-center justify-center text-sm text-slate-500">No sales in the last {days.length} days yet.</p>;
  }

  return (
    <figure>
      <div className="relative">
        {/* Recessive scale: peak value at the top, baseline at the bottom. */}
        <p className="absolute left-0 top-0 text-xs text-slate-400">{formatINR(max)}</p>
        <div className="flex h-44 items-end gap-0.5 border-b border-slate-200 pt-5" aria-hidden="true">
          {days.map((d, i) => {
            const pct = (d.sales / max) * 100;
            const isToday = i === lastIndex;
            return (
              <div key={d.date} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none">
                {isToday && d.sales > 0 && (
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-slate-700" style={{ bottom: `calc(${pct}% + 4px)` }}>
                    {formatINR(d.sales)}
                  </span>
                )}
                <div
                  className="w-full rounded-t-[4px] bg-brand-500 transition-colors group-hover:bg-brand-700 group-focus:bg-brand-700"
                  style={{ height: d.sales > 0 ? `max(${pct}%, 2px)` : 0 }}
                />
                {/* Tooltip: hit target is the whole column, not just the bar. */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow group-hover:block group-focus:block">
                  <p className="font-medium">{isToday ? "Today" : shortDate(d.date)}</p>
                  <p>{formatINR(d.sales)} · {d.orders} order{d.orders === 1 ? "" : "s"}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-0.5 text-[11px] text-slate-400" aria-hidden="true">
          {days.map((d, i) => (
            <span key={d.date} className="flex-1 text-center">
              {i === lastIndex ? "Today" : i % 3 === 1 ? shortDate(d.date) : ""}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">Daily sales for the last {days.length} days</figcaption>
      <table className="sr-only">
        <thead><tr><th>Date</th><th>Sales</th><th>Orders</th></tr></thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}><td>{d.date}</td><td>{formatINR(d.sales)}</td><td>{d.orders}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
