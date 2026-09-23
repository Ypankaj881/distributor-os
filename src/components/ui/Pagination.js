import Link from "next/link";
import { cn } from "./cn";

// Link-based pagination: works without JavaScript and keeps the page in the URL
// (so refresh/back/share keep the same page).
// `params` = the current filters; only `page` is changed.
export default function Pagination({ basePath, params = {}, page, totalPages, total }) {
  if (totalPages <= 1) return total != null ? <p className="text-sm text-slate-500">{total} result(s)</p> : null;

  const href = (p) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v != null && v !== "" && k !== "page") sp.set(k, String(v));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const linkClass = "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium ring-1 ring-inset ring-slate-300 bg-white hover:bg-slate-50";
  const disabledClass = "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-slate-300 ring-1 ring-inset ring-slate-200 bg-white";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages}
        {total != null && <span className="hidden sm:inline"> · {total} results</span>}
      </p>
      <div className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className={linkClass}>Previous</Link> : <span className={disabledClass}>Previous</span>}
        {page < totalPages ? <Link href={href(page + 1)} className={cn(linkClass)}>Next</Link> : <span className={disabledClass}>Next</span>}
      </div>
    </nav>
  );
}
