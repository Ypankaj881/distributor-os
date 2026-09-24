"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Alert from "@/components/ui/Alert";
import { api } from "@/lib/apiClient";

// Used on both the admin Settings page and the shop Account page.
export default function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    if (next !== confirm) return setErrors({ confirm: "The two new passwords don't match." });
    setSaving(true);
    const res = await api.post("/api/auth/password", { currentPassword: current, newPassword: next });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.error.fields ?? {});
      if (!res.error.fields) setMessage({ tone: "error", text: res.error.message });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setMessage({ tone: "success", text: "Password changed. You've been logged out on your other devices." });
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Change password</h2>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.currentPassword} />
        <Input label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.newPassword} hint="At least 8 characters." />
        <Input label="Repeat new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <Button type="submit" loading={saving} disabled={!current || !next || !confirm}>Change password</Button>
      </form>
    </Card>
  );
}
