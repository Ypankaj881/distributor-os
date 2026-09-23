import Link from "next/link";
import { cn } from "@/components/ui/cn";

// Horizontally scrollable brand filter. Keeps the current search.
export default function BrandChips({ brands, activeBrandId, q }) {
  const href = (brandId) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (brandId) sp.set("brandId", brandId);
    return sp.toString() ? `/products?${sp}` : "/products";
  };
  const chip = (active) =>
    cn(
      "shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap",
      active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700 active:bg-slate-100",
    );

  return (
    <nav aria-label="Filter by brand" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex gap-2 pb-1">
        <li><Link href={href("")} replace scroll={false} className={chip(!activeBrandId)}>All</Link></li>
        {brands.map((b) => (
          <li key={b.id}>
            <Link href={href(b.id)} replace scroll={false} className={chip(activeBrandId === b.id)} aria-current={activeBrandId === b.id ? "true" : undefined}>
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
