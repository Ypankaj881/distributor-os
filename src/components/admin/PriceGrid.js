"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import ListFilters from "./ListFilters";
import { api } from "@/lib/apiClient";
import { toPaise, fromPaise, formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";

function DiffBadge({ price, defaultPrice }) {
  if (!price || !defaultPrice || price === defaultPrice) return null;
  const pct = Math.round(((price - defaultPrice) / defaultPrice) * 1000) / 10;
  return <Badge tone={pct < 0 ? "green" : "amber"}>{pct > 0 ? "+" : ""}{pct}% vs default</Badge>;
}

function PriceRow({ row, draft, error, onDraft, onRemove, removing, timeZone }) {
  const { product, current, upcoming } = row;
  const effective = current?.price ?? product.defaultPrice;
  const draftPaise = draft ? toPaise(draft) : null;

  return (
    <li className="grid gap-3 p-4 md:grid-cols-[1fr_140px_200px_190px] md:items-start">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">
          {product.name}
          {!product.isActive && <Badge className="ml-2">Inactive</Badge>}
        </p>
        <p className="text-xs text-slate-500">
          {product.brandName} · <span className="font-mono">{product.sku}</span> · per {product.unit}
        </p>
      </div>

      <div className="text-sm">
        <p className="text-slate-500 md:hidden">Default</p>
        <p className="tabular-nums">{formatINR(product.defaultPrice)}</p>
        {product.mrp > 0 && <p className="text-xs text-slate-400">MRP {formatINR(product.mrp)}</p>}
      </div>

      <div className="text-sm">
        <p className="text-slate-500 md:hidden">This shop pays now</p>
        {current ? (
          <>
            <p className="font-semibold tabular-nums text-brand-700">{formatINR(current.price)}</p>
            <p className="text-xs text-slate-500">
              Special{current.effectiveTo ? ` · until ${formatDate(addDaysIso(current.effectiveTo, -1), timeZone)}` : ""}
            </p>
            <DiffBadge price={current.price} defaultPrice={product.defaultPrice} />
          </>
        ) : (
          <p className="tabular-nums text-slate-600">{formatINR(product.defaultPrice)} <span className="text-xs text-slate-400">(default)</span></p>
        )}
        {upcoming && (
          <p className="mt-1 text-xs text-amber-700">
            {formatINR(upcoming.price)} from {formatDate(upcoming.effectiveFrom, timeZone)}
            {upcoming.effectiveTo ? ` to ${formatDate(addDaysIso(upcoming.effectiveTo, -1), timeZone)}` : ""}
          </p>
        )}
        {(current || upcoming) && (
          <button type="button" onClick={onRemove} disabled={removing} className="mt-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-50">
            {removing ? "Removing…" : "Use default price"}
          </button>
        )}
      </div>

      <div>
        <Input
          aria-label={`New price for ${product.name}`}
          inputMode="decimal"
          placeholder={`₹ ${fromPaise(effective)}`}
          value={draft ?? ""}
          onChange={(e) => onDraft(e.target.value)}
          error={error}
          inputClassName={draft ? "border-brand-500 bg-brand-50/40" : ""}
        />
        {draftPaise > 0 && !error && <div className="mt-1"><DiffBadge price={draftPaise} defaultPrice={product.defaultPrice} /></div>}
      </div>
    </li>
  );
}

// effectiveTo is stored as the exclusive end instant; show the last included day.
function addDaysIso(iso, days) {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString();
}

export default function PriceGrid({ customer, rows, meta, filters, brands, today, timeZone }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState({}); // productId → "620"
  const [errors, setErrors] = useState({});
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [message, setMessage] = useState(null);

  const dirtyIds = Object.keys(drafts).filter((id) => drafts[id].trim() !== "");
  const dirty = dirtyIds.length > 0;

  // Warn before closing the tab with unsaved prices.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const confirmLeave = () => !dirty || window.confirm("You have unsaved prices. Leave without saving?");

  function setDraft(productId, value) {
    setDrafts((d) => ({ ...d, [productId]: value }));
    setErrors((e) => ({ ...e, [productId]: undefined }));
    setMessage(null);
  }

  async function save() {
    const localErrors = {};
    const prices = [];
    for (const id of dirtyIds) {
      const paise = toPaise(drafts[id]);
      if (!Number.isFinite(paise) || paise <= 0) localErrors[id] = "Enter a valid price.";
      else prices.push({ productId: id, price: paise });
    }
    if (Object.keys(localErrors).length) return setErrors(localErrors);

    setSaving(true);
    setMessage(null);
    const res = await api.put(`/api/admin/customers/${customer.id}/prices`, {
      prices,
      effectiveFrom: fromDate === today ? "" : fromDate,
      effectiveTo: toDate || null,
    });
    setSaving(false);

    if (!res.ok) {
      const f = res.error.fields ?? {};
      setErrors(f);
      setMessage({ tone: "error", text: f.effectiveFrom ?? f.effectiveTo ?? res.error.message });
      return;
    }
    setDrafts({});
    setErrors({});
    setMessage({
      tone: "success",
      text: `Saved ${res.data.saved} price${res.data.saved === 1 ? "" : "s"}${fromDate === today ? ", effective now" : `, effective from ${formatDate(res.data.effectiveFrom, timeZone)}`}.`,
    });
    router.refresh();
  }

  async function remove(productId, name) {
    if (!window.confirm(`Remove the special price for ${name}? ${customer.shopName} will pay the default price.`)) return;
    setRemovingId(productId);
    const res = await api.delete(`/api/admin/customers/${customer.id}/prices/${productId}`);
    setRemovingId(null);
    if (!res.ok) return setMessage({ tone: "error", text: res.error.message });
    setMessage({ tone: "success", text: `${name} is back to the default price.` });
    router.refresh();
  }

  return (
    // Intercept link clicks (pagination etc.) while there are unsaved prices.
    <div className="space-y-4 pb-24" onClickCapture={(e) => { if (e.target.closest("a") && !confirmLeave()) e.preventDefault(); }}>
      <ListFilters
        basePath={`/admin/customers/${customer.id}/pricing`}
        beforeNavigate={confirmLeave}
        search={{ value: filters.q ?? "", placeholder: "Search products" }}
        selects={[
          { name: "brandId", label: "Brand", value: filters.brandId ?? "", options: [{ value: "", label: "All brands" }, ...brands.map((b) => ({ value: b.id, label: b.name }))] },
          { name: "view", label: "Show", value: filters.view, defaultValue: "all", options: [{ value: "all", label: "All products" }, { value: "special", label: "Special prices only" }] },
        ]}
      />

      <Card className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_2fr] sm:items-end">
        <Input label="New prices apply from" type="date" min={today} value={fromDate} onChange={(e) => setFromDate(e.target.value || today)} />
        <Input label="Until (optional)" type="date" min={fromDate} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <p className="text-sm text-slate-500">
          Type a new price next to any product, then save. The shop sees its price instead of the default.
          Old prices are kept as history.
        </p>
      </Card>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon="tag"
            title={filters.view === "special" ? "No special prices yet" : "No products found"}
            description={filters.view === "special" ? "This shop pays the default price for everything." : "Try a different search."}
          />
        ) : (
          <>
            <div className="hidden grid-cols-[1fr_140px_200px_190px] gap-3 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
              <span>Product</span><span>Default</span><span>This shop pays</span><span>New price (₹)</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((row) => (
                <PriceRow
                  key={row.product.id}
                  row={row}
                  timeZone={timeZone}
                  draft={drafts[row.product.id]}
                  error={errors[row.product.id]}
                  onDraft={(v) => setDraft(row.product.id, v)}
                  onRemove={() => remove(row.product.id, row.product.name)}
                  removing={removingId === row.product.id}
                />
              ))}
            </ul>
          </>
        )}
      </Card>

      <Pagination
        basePath={`/admin/customers/${customer.id}/pricing`}
        params={{ q: filters.q, brandId: filters.brandId, view: filters.view === "all" ? "" : filters.view }}
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
      />

      {dirty && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-sm font-medium">
              {dirtyIds.length} unsaved price{dirtyIds.length === 1 ? "" : "s"}
              <span className="hidden font-normal text-slate-500 sm:inline">
                {" "}· from {fromDate === today ? "now" : formatDate(`${fromDate}T12:00:00Z`, timeZone)}
                {toDate ? ` until ${formatDate(`${toDate}T12:00:00Z`, timeZone)}` : ""}
              </span>
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setDrafts({}); setErrors({}); }} disabled={saving}>Discard</Button>
              <Button onClick={save} loading={saving}>Save prices</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
