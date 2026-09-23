"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Spinner from "@/components/ui/Spinner";

// Generic search + dropdown filters that live in the URL (?q=&brandId=…),
// so lists are shareable and survive refresh. Search is debounced: it waits
// until typing pauses for 350 ms before querying.
//
// selects: [{ name: "status", label: "Status", value: "all", defaultValue: "all",
//             options: [{ value: "all", label: "All status" }, …] }]
// beforeNavigate: optional () => boolean — return false to cancel (unsaved changes).
export default function ListFilters({ basePath, search, selects = [], beforeNavigate }) {
  const router = useRouter();
  const [text, setText] = useState(search?.value ?? "");
  const [isPending, startTransition] = useTransition();
  const lastPushed = useRef(search?.value ?? "");

  function navigate(changes) {
    if (beforeNavigate && !beforeNavigate()) return false;
    const values = { q: text, ...Object.fromEntries(selects.map((s) => [s.name, s.value])), ...changes };
    const sp = new URLSearchParams();
    if (values.q?.trim()) sp.set("q", values.q.trim());
    for (const s of selects) {
      const v = values[s.name];
      if (v && v !== (s.defaultValue ?? "")) sp.set(s.name, v);
    }
    lastPushed.current = values.q ?? "";
    const qs = sp.toString();
    startTransition(() => router.replace(qs ? `${basePath}?${qs}` : basePath));
    return true;
  }

  useEffect(() => {
    if (!search || text.trim() === lastPushed.current.trim()) return;
    const timer = setTimeout(() => {
      if (!navigate({ q: text })) setText(lastPushed.current);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const selectClass =
    "h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      {search && (
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          {isPending && <Spinner className="absolute right-3 top-3 text-slate-400" />}
        </div>
      )}
      {selects.length > 0 && (
        <div className="grid gap-2 lg:flex" style={{ gridTemplateColumns: `repeat(${selects.length}, minmax(0, 1fr))` }}>
          {selects.map((s) => (
            <select key={s.name} aria-label={s.label} value={s.value} onChange={(e) => navigate({ [s.name]: e.target.value })} className={selectClass}>
              {s.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ))}
        </div>
      )}
    </div>
  );
}
