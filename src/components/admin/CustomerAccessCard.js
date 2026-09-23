"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import PasswordSetter from "./PasswordSetter";
import LoginDetailsBox from "./LoginDetailsBox";
import { api } from "@/lib/apiClient";
import { generatePassword } from "@/lib/generatePassword";
import { formatPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/dates";

// Login status, activate/deactivate and password reset for one shop.
export default function CustomerAccessCard({ customer, timeZone }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState("");
  const [newLogin, setNewLogin] = useState(null);

  async function toggleActive() {
    const next = !customer.isActive;
    const warning = next
      ? `Activate ${customer.shopName}? They will be able to log in and order again.`
      : `Deactivate ${customer.shopName}? They will be logged out immediately and can't place orders.`;
    if (!window.confirm(warning)) return;
    setBusy("status");
    setError(null);
    const res = await api.patch(`/api/admin/customers/${customer.id}/status`, { isActive: next });
    setBusy(null);
    if (!res.ok) return setError(res.error.message);
    router.refresh();
  }

  async function savePassword() {
    setBusy("password");
    setError(null);
    const res = await api.post(`/api/admin/customers/${customer.id}/password`, { password });
    setBusy(null);
    if (!res.ok) return setError(res.error.fields?.password ?? res.error.message);
    setNewLogin({ phone: customer.phone, password });
    setResetting(false);
    setPassword("");
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Login &amp; access</h2>
        {customer.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">Login mobile</dt>
        <dd className="font-medium">{formatPhone(customer.login.phone)}</dd>
        <dt className="text-slate-500">Last login</dt>
        <dd>{customer.login.lastLoginAt ? formatDateTime(customer.login.lastLoginAt, timeZone) : "Never"}</dd>
      </dl>

      {error && <Alert tone="error">{error}</Alert>}
      {newLogin && <LoginDetailsBox shopName={customer.shopName} phone={newLogin.phone} password={newLogin.password} />}

      {resetting ? (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          <PasswordSetter label="New password" value={password} onChange={setPassword} />
          <p className="text-xs text-slate-500">The shop will be logged out on all devices.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={savePassword} loading={busy === "password"}>Save password</Button>
            <Button size="sm" variant="ghost" onClick={() => setResetting(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <Button variant="secondary" onClick={() => { setResetting(true); setNewLogin(null); setPassword(generatePassword()); }}>
            Set new password
          </Button>
          <Button
            variant="ghost"
            className={customer.isActive ? "text-red-600 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}
            onClick={toggleActive}
            loading={busy === "status"}
          >
            {customer.isActive ? "Deactivate customer" : "Activate customer"}
          </Button>
        </div>
      )}
    </Card>
  );
}
