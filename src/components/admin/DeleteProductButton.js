"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { api } from "@/lib/apiClient";

export default function DeleteProductButton({ productId, productName }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onDelete() {
    if (!window.confirm(`Delete "${productName}"? It will be removed from the catalog. Past orders keep their copy of it.`)) return;
    setBusy(true);
    const res = await api.delete(`/api/admin/products/${productId}`);
    if (!res.ok) {
      setBusy(false);
      return setError(res.error.message);
    }
    router.push("/admin/products");
    router.refresh();
  }

  return (
    <div>
      <Button variant="dangerGhost" className="w-full" onClick={onDelete} loading={busy}>
        Delete product
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
