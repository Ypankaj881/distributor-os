"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Spinner from "@/components/ui/Spinner";

// Filters live in the URL (?q=&brandId=&status=&stock=) so the list is
// shareable and survives refresh. Search is debounced: we wait until typing
// pauses for 350 ms before querying, instead of querying on every keystroke.
export default function ProductFilters({ q = "", brandId = "", status = "all", stock = "", brands }) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [isPending, startTransition] = useTransition();

  function navigate(next) {
    const params = { q: search, brandId, status, stock, ...next };
    const sp = new URLSearchParams();
    if (params.q?.trim()) sp.set("q", params.q.trim());
    if (params.brandId) sp.set("brandId", params.brandId);
    if (params.status && params.status !== "all") sp.set("status", params.status);
    if (params.stock) sp.set("stock", params.stock);
    const qs = sp.toString();
    startTransition(() => router.replace(qs ? `/admin/products?${qs}` : "/admin/products"));
  }

  useEffect(() => {
    if (search.trim() === q.trim()) return;
    const timer = setTimeout(() => navigate({ q: search }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const selectClass = "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, SKU or brand"
          aria-label="Search products"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        {isPending && <Spinner className="absolute right-3 top-3 text-slate-400" />}
      </div>
      <div className="grid grid-cols-3 gap-2 lg:flex">
        <select aria-label="Brand" value={brandId} onChange={(e) => navigate({ brandId: e.target.value })} className={selectClass}>
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => navigate({ status: e.target.value })} className={selectClass}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select aria-label="Stock" value={stock} onChange={(e) => navigate({ stock: e.target.value })} className={selectClass}>
          <option value="">All stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
      </div>
    </div>
  );
}
