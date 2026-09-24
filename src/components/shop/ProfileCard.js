"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Alert from "@/components/ui/Alert";
import { api } from "@/lib/apiClient";
import { formatPhone } from "@/lib/phone";

// Shop name, login mobile and GSTIN are managed by the distributor (they
// affect billing and login); the shop edits its contact name and email.
export default function ProfileCard({ profile, distributorName }) {
  const router = useRouter();
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [email, setEmail] = useState(profile.email);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const dirty = ownerName !== profile.ownerName || email !== profile.email;

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const res = await api.patch("/api/shop/profile", { ownerName, email: email.trim() });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.error.fields ?? {});
      setMessage({ tone: "error", text: res.error.message });
      return;
    }
    setMessage({ tone: "success", text: "Saved." });
    router.refresh();
  }

  return (
    <Card className="p-4">
      <h2 className="font-semibold">{profile.shopName}</h2>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Login mobile</dt><dd>{formatPhone(profile.phone)}</dd>
        <dt className="text-slate-500">Customer code</dt><dd className="font-mono text-[13px]">{profile.customerCode}</dd>
        {profile.gstin && (<><dt className="text-slate-500">GSTIN</dt><dd className="font-mono text-[13px]">{profile.gstin}</dd></>)}
      </dl>
      <p className="mt-2 text-xs text-slate-500">To change the shop name, mobile or GSTIN, contact {distributorName}.</p>

      <form onSubmit={save} noValidate className="mt-4 space-y-4 border-t border-slate-100 pt-4">
        <Input label="Your name" value={ownerName} onChange={(e) => { setOwnerName(e.target.value); setMessage(null); }} error={errors.ownerName} maxLength={100} autoComplete="name" />
        <Input label="Email (optional)" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setMessage(null); }} error={errors.email} autoComplete="email" />
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <Button type="submit" loading={saving} disabled={!dirty}>Save</Button>
      </form>
    </Card>
  );
}
