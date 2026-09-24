"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import AddressFields, { EMPTY_ADDRESS } from "@/components/forms/AddressFields";
import { api } from "@/lib/apiClient";

const formatAddress = (a) => [a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", ");

function AddressForm({ initial, onSaved, onCancel }) {
  const [label, setLabel] = useState(initial?.label ?? "Shop");
  const [address, setAddress] = useState({ ...EMPTY_ADDRESS, ...initial });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setError(null);
    const body = { label, line1: address.line1, line2: address.line2, landmark: address.landmark, city: address.city, state: address.state, pincode: address.pincode };
    const res = initial?.id ? await api.patch(`/api/shop/addresses/${initial.id}`, body) : await api.post("/api/shop/addresses", body);
    setSaving(false);
    if (!res.ok) {
      // AddressFields shows errors keyed "<prefix>.<field>"
      setErrors(Object.fromEntries(Object.entries(res.error.fields ?? {}).map(([k, v]) => [`address.${k}`, v])));
      if (!res.error.fields) setError(res.error.message);
      return;
    }
    onSaved(res.data);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Input label="Name for this address" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="e.g. Shop, Godown" />
      <AddressFields prefix="address" value={address} onChange={setAddress} errors={errors} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>Save address</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export default function AddressBook({ initialAddresses }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editing, setEditing] = useState(null); // null | "new" | address id
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function act(id, request) {
    setBusy(id);
    setError(null);
    const res = await request();
    setBusy(null);
    if (!res.ok) return setError(res.error.message);
    setAddresses(res.data);
  }

  const makeDefault = (id) => act(id, () => api.patch(`/api/shop/addresses/${id}`, { isDefault: true }));
  const remove = (a) => {
    if (!window.confirm(`Delete the address "${a.label}"? Past orders are not affected.`)) return;
    act(a.id, () => api.delete(`/api/shop/addresses/${a.id}`));
  };
  const saved = (list) => {
    setAddresses(list);
    setEditing(null);
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Delivery addresses</h2>
        {editing === null && addresses.length < 10 && <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>Add address</Button>}
      </div>
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}

      {editing === "new" && (
        <div className="mb-4 rounded-lg border border-slate-200 p-3">
          <AddressForm onSaved={saved} onCancel={() => setEditing(null)} />
        </div>
      )}

      {addresses.length === 0 && editing !== "new" ? (
        <p className="text-sm text-slate-500">No address yet. Add one so the distributor knows where to deliver.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {addresses.map((a) => (
            <li key={a.id} className="py-3">
              {editing === a.id ? (
                <AddressForm initial={a} onSaved={saved} onCancel={() => setEditing(null)} />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.label}</p>
                    {a.isDefault && <Badge tone="blue">Default</Badge>}
                  </div>
                  <p className="text-sm text-slate-600">{formatAddress(a) || <span className="text-amber-700">Address not filled in — tap Edit</span>}</p>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(a.id)} disabled={Boolean(busy)}>Edit</Button>
                    {!a.isDefault && <Button size="sm" variant="ghost" onClick={() => makeDefault(a.id)} loading={busy === a.id} disabled={Boolean(busy)}>Make default</Button>}
                    <Button size="sm" variant="dangerGhost" onClick={() => remove(a)} disabled={Boolean(busy)}>Delete</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
