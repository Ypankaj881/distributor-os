"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";
import Alert from "@/components/ui/Alert";
import AddressFields from "./AddressFields";
import { api } from "@/lib/apiClient";
import { cn } from "@/components/ui/cn";

export default function SettingsForm({ company }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: company.name,
    phone: company.phone,
    email: company.email,
    gstin: company.gstin,
    address: company.address,
    orderPrefix: company.settings.orderPrefix,
    pricesIncludeGst: company.settings.pricesIncludeGst,
    allowNegativeStock: company.settings.allowNegativeStock,
    lowStockThreshold: String(company.settings.lowStockThreshold),
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
    setMessage(null);
  };

  async function onSubmit(e) {
    e.preventDefault();
    if (form.pricesIncludeGst !== company.settings.pricesIncludeGst) {
      const ok = window.confirm(
        form.pricesIncludeGst
          ? "Prices will be treated as INCLUDING GST from now on. Shops will see and pay the price as-is. Existing orders don't change. Continue?"
          : "GST will be ADDED on top of prices from now on. Shops will pay more than the listed price. Existing orders don't change. Continue?",
      );
      if (!ok) return;
    }
    setSaving(true);
    setErrors({});
    const res = await api.patch("/api/admin/settings", {
      name: form.name,
      phone: form.phone.trim(),
      email: form.email.trim(),
      gstin: form.gstin.trim(),
      address: form.address,
      settings: {
        orderPrefix: form.orderPrefix,
        pricesIncludeGst: form.pricesIncludeGst,
        allowNegativeStock: form.allowNegativeStock,
        lowStockThreshold: form.lowStockThreshold.trim() === "" ? NaN : Number(form.lowStockThreshold),
      },
    });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.error.fields ?? {});
      setMessage({ tone: "error", text: res.error.message });
      return;
    }
    setMessage({ tone: "success", text: "Settings saved." });
    router.refresh(); // header/sidebar pick up the new name
  }

  const prefix = (form.orderPrefix || "ORD").toUpperCase();

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Business details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input className="sm:col-span-2" label="Business name" value={form.name} onChange={set("name")} error={errors.name} maxLength={120} />
          <Input
            label="WhatsApp / phone number"
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={set("phone")}
            error={errors.phone}
            hint="Shops' “Share on WhatsApp” goes to this number. Also shown on the login page."
          />
          <Input label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} />
          <Input label="GSTIN" value={form.gstin} onChange={set("gstin")} error={errors.gstin} maxLength={15} autoCapitalize="characters" />
        </div>
        <AddressFields prefix="address" value={form.address} onChange={(address) => setForm((f) => ({ ...f, address }))} errors={errors} />
      </Card>

      <Card className="space-y-5 p-5">
        <h2 className="font-semibold">Orders, prices &amp; stock</h2>

        <Input
          className="max-w-xs"
          label="Order number prefix"
          value={form.orderPrefix}
          onChange={set("orderPrefix")}
          error={errors["settings.orderPrefix"]}
          maxLength={6}
          autoCapitalize="characters"
          hint={`New orders will be numbered like ${prefix}-1024. Existing orders keep their numbers.`}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Product prices are…</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { value: false, title: "Before GST", body: "GST is added on top at checkout (e.g. ₹650 + 18% = ₹767)." },
              { value: true, title: "Including GST", body: "The listed price is final; GST is the part inside it." },
            ].map((o) => (
              <label key={String(o.value)} className={cn("flex cursor-pointer gap-3 rounded-lg border p-3", form.pricesIncludeGst === o.value ? "border-brand-500 bg-brand-50/50" : "border-slate-200")}>
                <input type="radio" name="gst-mode" className="mt-1 size-4 accent-brand-600" checked={form.pricesIncludeGst === o.value} onChange={() => setForm((f) => ({ ...f, pricesIncludeGst: o.value }))} />
                <span className="text-sm"><span className="font-medium">{o.title}</span><span className="block text-slate-500">{o.body}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        <Input
          className="max-w-xs"
          label="Low stock warning at"
          inputMode="numeric"
          value={form.lowStockThreshold}
          onChange={set("lowStockThreshold")}
          error={errors["settings.lowStockThreshold"]}
          hint="Products at or below this quantity show as “Low stock”."
        />

        <Checkbox
          label="Allow orders when stock is not enough"
          description="Shops can order out-of-stock items and you can confirm them; stock may go below zero. Leave off to block this."
          checked={form.allowNegativeStock}
          onChange={set("allowNegativeStock")}
        />

        <p className="text-xs text-slate-500">Timezone: {company.settings.timezone} (dates, “today” and daily sales use this).</p>
      </Card>

      <Button type="submit" size="lg" loading={saving}>Save settings</Button>
    </form>
  );
}
