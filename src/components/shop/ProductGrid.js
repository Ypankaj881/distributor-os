"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import ProductCard from "./ProductCard";
import { api } from "@/lib/apiClient";

// First page is rendered on the server (fast first paint); "Load more" fetches
// the next pages from the API and appends them — easier on phones than
// numbered pages. The parent gives it a `key` per search, so a new search
// starts fresh.
export default function ProductGrid({ initialItems, initialMeta, query }) {
  const [items, setItems] = useState(initialItems);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadMore() {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams();
    if (query.q) sp.set("q", query.q);
    if (query.brandId) sp.set("brandId", query.brandId);
    sp.set("page", String(meta.page + 1));
    sp.set("limit", String(meta.limit));
    const res = await api.get(`/api/shop/products?${sp}`);
    setLoading(false);
    if (!res.ok) return setError(res.error.message);
    // De-duplicate in case a product was added between page loads.
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...res.data.filter((p) => !seen.has(p.id))];
    });
    setMeta(res.meta);
  }

  const hasMore = meta.page < meta.totalPages;

  return (
    <div className="space-y-4">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>

      {error && <Alert tone="error">{error}</Alert>}

      {hasMore ? (
        <Button variant="secondary" size="lg" className="w-full" onClick={loadMore} loading={loading}>
          {loading ? "Loading…" : `Show more (${meta.total - items.length} left)`}
        </Button>
      ) : (
        items.length > 8 && <p className="text-center text-sm text-slate-500">That&apos;s all {meta.total} products.</p>
      )}
    </div>
  );
}
