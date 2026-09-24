"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/Checkbox";
import Icon from "@/components/ui/Icon";
import Spinner from "@/components/ui/Spinner";
import { api } from "@/lib/apiClient";
import { formatINR } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { newUuid } from "@/lib/uuid";
import { cn } from "@/components/ui/cn";

// Debounced search box that calls `search(text)` 300 ms after typing stops.
function SearchBox({ placeholder, onResults, search, autoFocus }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!text.trim()) return onResults([]);
      setBusy(true);
      onResults(await search(text.trim()));
      setBusy(false);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <div className="relative">
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      {busy && <Spinner className="absolute right-3 top-3.5 text-slate-400" />}
    </div>
  );
}

function ShopPicker({ shop, onPick }) {
  const [results, setResults] = useState([]);
  if (shop) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
        <div className="min-w-0">
          <p className="font-medium">{shop.shopName}</p>
          <p className="text-sm text-slate-500"><span className="font-mono">{shop.customerCode}</span> · {formatPhone(shop.phone)}{shop.city ? ` · ${shop.city}` : ""}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onPick(null)}>Change</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <SearchBox
        autoFocus
        placeholder="Search shop name, owner, mobile or code"
        onResults={setResults}
        search={async (q) => {
          const res = await api.get(`/api/admin/customers?q=${encodeURIComponent(q)}&status=active&limit=8`);
          return res.ok ? res.data : [];
        }}
      />
      {results.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onPick(c)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.shopName}</span>
                  <span className="text-xs text-slate-500">{c.customerCode} · {formatPhone(c.phone)}{c.city ? ` · ${c.city}` : ""}</span>
                </span>
                <Icon name="plus" className="size-5 text-brand-600" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminOrderBuilder({ initialShop }) {
  const router = useRouter();
  const [shop, setShop] = useState(initialShop ?? null);
  const [items, setItems] = useState([]); // [{ productId, quantity }]
  const [productResults, setProductResults] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [addressId, setAddressId] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmNow, setConfirmNow] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const keyRef = useRef(null);

  // Re-price on the server whenever the shop or the lines change.
  useEffect(() => {
    if (!shop) return;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      const res = await api.post("/api/admin/orders/preview", { customerId: shop.id, items });
      setPreviewing(false);
      if (!res.ok) return setError(res.error.message);
      setError(null);
      setPreview(res.data);
      setAddressId((current) => current || res.data.addresses.find((a) => a.isDefault)?.id || res.data.addresses[0]?.id || "");
    }, 250);
    return () => clearTimeout(timer);
  }, [shop, items]);

  function pickShop(next) {
    setShop(next);
    setPreview(null);
    setAddressId("");
    keyRef.current = null;
  }

  function addProduct(p) {
    setItems((list) => (list.some((i) => i.productId === p.id) ? list : [...list, { productId: p.id, quantity: Math.max(p.minOrderQty ?? 1, 1) }]));
    keyRef.current = null;
  }
  const setQty = (productId, quantity) => {
    setItems((list) => list.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
    keyRef.current = null;
  };
  const removeLine = (productId) => setItems((list) => list.filter((i) => i.productId !== productId));

  async function place() {
    if (!preview?.canCheckout || placing) return;
    setPlacing(true);
    setError(null);
    keyRef.current ??= newUuid();
    const res = await api.post("/api/admin/orders", {
      customerId: shop.id,
      items,
      ...(addressId && { addressId }),
      notes,
      idempotencyKey: keyRef.current,
      expectedTotal: preview.totals.total,
      confirmNow,
    });
    if (!res.ok) {
      setPlacing(false);
      setError(res.error.message);
      return;
    }
    router.push(`/admin/orders/${res.data.id}`);
  }

  const linesById = new Map((preview?.lines ?? []).map((l) => [l.productId, l]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="space-y-6">
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">1. Shop</h2>
          <ShopPicker shop={shop} onPick={pickShop} />
        </Card>

        <Card className={cn("space-y-4 p-5", !shop && "pointer-events-none opacity-50")}>
          <h2 className="font-semibold">2. Products</h2>
          <SearchBox
            placeholder="Search product name, SKU or brand"
            onResults={setProductResults}
            search={async (q) => {
              const res = await api.get(`/api/admin/products?q=${encodeURIComponent(q)}&status=active&limit=8`);
              return res.ok ? res.data : [];
            }}
          />
          {productResults.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {productResults.map((p) => {
                const added = items.some((i) => i.productId === p.id);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="text-xs text-slate-500">{p.brand.name} · <span className="font-mono">{p.sku}</span> · stock {p.stockQuantity} {p.unit}</span>
                    </span>
                    <Button size="sm" variant={added ? "ghost" : "secondary"} disabled={added} onClick={() => addProduct(p)}>{added ? "Added" : "Add"}</Button>
                  </li>
                );
              })}
            </ul>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-slate-500">Search and add the products the shop asked for.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {items.map((i) => {
                const line = linesById.get(i.productId);
                return (
                  <li key={i.productId} className="grid grid-cols-[1fr_auto] gap-3 p-3 text-sm sm:grid-cols-[1fr_110px_110px_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{line?.name ?? "…"}</p>
                      {line?.available && <p className="text-xs text-slate-500">{formatINR(line.price)} / {line.unit} (this shop&apos;s price) · GST {line.gstRate}%</p>}
                      {line?.issues?.map((iss) => <p key={iss.code} className="text-xs font-medium text-red-600">{iss.message}</p>)}
                    </div>
                    <input
                      inputMode="numeric"
                      aria-label="Quantity"
                      value={i.quantity}
                      onChange={(e) => setQty(i.productId, Math.max(1, parseInt(e.target.value.replace(/\D/g, ""), 10) || 1))}
                      className="h-10 w-24 rounded-lg border border-slate-300 px-3 text-right tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                    <p className="text-right font-medium tabular-nums">{line ? formatINR(line.taxable) : ""}</p>
                    <button type="button" onClick={() => removeLine(i.productId)} aria-label="Remove" className="justify-self-end rounded-lg p-2 text-slate-400 hover:text-red-600">
                      <Icon name="x" className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6">
        <Card className={cn("space-y-4 p-5", !shop && "opacity-50")}>
          <h2 className="font-semibold">3. Delivery &amp; place order</h2>
          {preview?.addresses?.length > 0 && (
            <div>
              <label htmlFor="addr" className="mb-1.5 block text-sm font-medium text-slate-700">Deliver to</label>
              <select id="addr" value={addressId} onChange={(e) => setAddressId(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                {preview.addresses.map((a) => <option key={a.id} value={a.id}>{a.label}{a.text ? ` — ${a.text}` : ""}</option>)}
              </select>
            </div>
          )}
          <Textarea label="Note (optional)" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Ordered on phone by Rajesh" />
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{formatINR(preview?.totals.subtotal ?? 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">GST</dt><dd className="tabular-nums">{formatINR(preview?.totals.gst ?? 0)}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="flex items-center gap-2 tabular-nums">{previewing && <Spinner className="text-slate-400" />}{formatINR(preview?.totals.total ?? 0)}</dd>
            </div>
          </dl>
          <Checkbox label="Confirm right away" description="Skips the “New” step and deducts stock now." checked={confirmNow} onChange={(e) => setConfirmNow(e.target.checked)} />
          {error && <Alert tone="error">{error}</Alert>}
          {preview && items.length > 0 && !preview.canCheckout && <Alert tone="warning">Fix the lines marked in red first.</Alert>}
          <Button size="lg" className="w-full" onClick={place} loading={placing} disabled={!shop || items.length === 0 || !preview?.canCheckout || previewing}>
            {confirmNow ? "Place & confirm order" : "Place order"}
          </Button>
          <p className="text-xs text-slate-500">The shop sees this order in its app, marked as placed by you. Its own cart is not changed.</p>
        </Card>
        {shop && <Badge tone="blue">Prices shown are {shop.shopName}&apos;s prices</Badge>}
      </div>
    </div>
  );
}
