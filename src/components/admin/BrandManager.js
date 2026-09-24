"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import { api } from "@/lib/apiClient";

function AddBrandForm({ onDone }) {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await api.post("/api/admin/brands", { name });
    setSaving(false);
    if (!res.ok) return setError(res.error.fields?.name ?? res.error.message);
    setName("");
    onDone(`Added "${res.data.name}".`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <Input
        className="flex-1"
        aria-label="New brand name"
        placeholder="New brand name, e.g. Bellavita"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error}
        maxLength={80}
      />
      <Button type="submit" loading={saving} disabled={!name.trim()} className="h-11">
        Add brand
      </Button>
    </form>
  );
}

function BrandRow({ brand, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(brand.name);
  const [sortOrder, setSortOrder] = useState(String(brand.sortOrder));
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState(null);

  async function run(request, successMessage) {
    setBusy(true);
    const res = await request();
    setBusy(false);
    if (!res.ok) {
      if (res.error.fields?.name) setFieldError(res.error.fields.name);
      else onError(res.error.message);
      return false;
    }
    onChanged(successMessage);
    return true;
  }

  async function save() {
    setFieldError(null);
    const ok = await run(
      () => api.patch(`/api/admin/brands/${brand.id}`, { name, sortOrder: Number(sortOrder) || 0 }),
      `Saved "${name.trim()}".`,
    );
    if (ok) setEditing(false);
  }

  const toggleActive = () =>
    run(
      () => api.patch(`/api/admin/brands/${brand.id}`, { isActive: !brand.isActive }),
      `${brand.name} is now ${brand.isActive ? "hidden from" : "visible to"} retailers.`,
    );

  const remove = () => {
    if (!window.confirm(`Delete brand "${brand.name}"? This can't be undone.`)) return;
    run(() => api.delete(`/api/admin/brands/${brand.id}`), `Deleted "${brand.name}".`);
  };

  if (editing) {
    return (
      <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <Input className="flex-1" aria-label="Brand name" value={name} onChange={(e) => setName(e.target.value)} error={fieldError} maxLength={80} />
        <Input
          className="sm:w-28"
          aria-label="Display order"
          type="number"
          min={0}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          hint="Display order"
        />
        <div className="flex gap-2">
          <Button onClick={save} loading={busy} className="h-11">Save</Button>
          <Button variant="secondary" className="h-11" onClick={() => { setEditing(false); setName(brand.name); setSortOrder(String(brand.sortOrder)); setFieldError(null); }}>
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-slate-900">{brand.name}</p>
          {!brand.isActive && <Badge tone="gray">Hidden</Badge>}
        </div>
        <Link href={`/admin/products?brandId=${brand.id}`} className="text-sm text-brand-600 hover:underline">
          {brand.productCount} product{brand.productCount === 1 ? "" : "s"}
        </Link>
        <span className="text-sm text-slate-400"> · Order {brand.sortOrder}</span>
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={busy}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={toggleActive} disabled={busy}>{brand.isActive ? "Hide" : "Show"}</Button>
        <Button
          size="sm"
          variant="dangerGhost"
          onClick={remove}
          disabled={busy || brand.productCount > 0}
          title={brand.productCount > 0 ? "Remove or move this brand's products first" : undefined}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

export default function BrandManager({ brands }) {
  const router = useRouter();
  const [message, setMessage] = useState(null);

  const onChanged = (text) => {
    setMessage({ tone: "success", text });
    router.refresh(); // re-runs the server component to fetch fresh data
  };
  const onError = (text) => setMessage({ tone: "error", text });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <AddBrandForm onDone={onChanged} />
      </Card>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Card>
        {brands.length === 0 ? (
          <EmptyState icon="layers" title="No brands yet" description="Add the brands/agencies you distribute, then add their products." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {brands.map((b) => (
              <BrandRow key={`${b.id}-${b.updatedAt}`} brand={b} onChanged={onChanged} onError={onError} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
