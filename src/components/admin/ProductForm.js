"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/Checkbox";
import Card from "@/components/ui/Card";
import Alert from "@/components/ui/Alert";
import ProductImage from "@/components/ui/ProductImage";
import { api } from "@/lib/apiClient";
import { toPaise, fromPaise, formatINR } from "@/lib/money";
import { GST_RATES, PRODUCT_UNITS } from "@/lib/constants";

// Form state holds strings (what inputs produce). They are converted to
// numbers/paise only when building the request body.
function initialState(product) {
  return {
    brandId: product?.brand.id ?? "",
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    description: product?.description ?? "",
    imageUrl: product?.imageUrl ?? "",
    unit: product?.unit ?? "piece",
    packSize: product?.packSize ? String(product.packSize) : "",
    mrp: product?.mrp ? String(fromPaise(product.mrp)) : "",
    defaultPrice: product ? String(fromPaise(product.defaultPrice)) : "",
    gstRate: String(product?.gstRate ?? 18),
    hsnCode: product?.hsnCode ?? "",
    minOrderQty: String(product?.minOrderQty ?? 1),
    stockQuantity: "0",
    isActive: product?.isActive ?? true,
  };
}

// Empty numeric inputs become NaN so the server's validation reports
// "Enter a valid …" instead of silently saving 0.
const num = (v) => (v.trim() === "" ? NaN : Number(v));

function toPayload(form, isNew) {
  const payload = {
    brandId: form.brandId,
    name: form.name,
    sku: form.sku,
    description: form.description,
    imageUrl: form.imageUrl.trim(),
    unit: form.unit,
    packSize: form.packSize.trim() ? num(form.packSize) : null,
    mrp: form.mrp.trim() ? toPaise(form.mrp) : 0,
    defaultPrice: form.defaultPrice.trim() ? toPaise(form.defaultPrice) : NaN,
    gstRate: Number(form.gstRate),
    hsnCode: form.hsnCode.trim(),
    minOrderQty: num(form.minOrderQty),
    isActive: form.isActive,
  };
  if (isNew) payload.stockQuantity = form.stockQuantity.trim() ? num(form.stockQuantity) : 0;
  // JSON.stringify turns NaN into null → the server rejects it with a clear message.
  return payload;
}

export default function ProductForm({ product, brands }) {
  const router = useRouter();
  const isNew = !product;
  const [form, setForm] = useState(() => initialState(product));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  };

  async function onSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});
    setFormError(null);

    const body = toPayload(form, isNew);
    const res = isNew ? await api.post("/api/admin/products", body) : await api.patch(`/api/admin/products/${product.id}`, body);
    setSaving(false);

    if (!res.ok) {
      setErrors(res.error.fields ?? {});
      setFormError(res.error.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (isNew) {
      router.push(`/admin/products/${res.data.id}?created=1`);
    } else {
      setSaved(true);
      router.refresh();
    }
  }

  const priceP = toPaise(form.defaultPrice);
  const mrpP = toPaise(form.mrp);
  const marginNote = priceP > 0 && mrpP > 0 && priceP <= mrpP ? `${Math.round(((mrpP - priceP) / mrpP) * 100)}% below MRP` : null;
  const gstNote = priceP > 0 ? `+ ${form.gstRate}% GST = ${formatINR(priceP + Math.round((priceP * Number(form.gstRate)) / 100))}` : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && <Alert tone="error">{formError}</Alert>}
      {saved && <Alert tone="success">Changes saved.</Alert>}

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Basic details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Brand *" value={form.brandId} onChange={set("brandId")} error={errors.brandId}>
            <option value="">Select brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.isActive ? "" : " (hidden)"}</option>
            ))}
          </Select>
          <Input label="SKU / product code *" value={form.sku} onChange={set("sku")} error={errors.sku} placeholder="e.g. BV-CEO-100" maxLength={40} autoCapitalize="characters" />
        </div>
        <Input label="Product name *" value={form.name} onChange={set("name")} error={errors.name} placeholder="e.g. CEO Perfume 100ml" maxLength={150} />
        <Textarea label="Description" value={form.description} onChange={set("description")} error={errors.description} maxLength={2000} />
        <div className="flex gap-4">
          <ProductImage src={errors.imageUrl ? "" : form.imageUrl} alt={form.name || "Product"} className="size-20 shrink-0" />
          <Input className="flex-1" label="Image link" type="url" value={form.imageUrl} onChange={set("imageUrl")} error={errors.imageUrl} placeholder="https://…" hint="Paste a public https:// image URL. Uploads will come later." />
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Pricing &amp; tax</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Default selling price (₹) *" inputMode="decimal" value={form.defaultPrice} onChange={set("defaultPrice")} error={errors.defaultPrice} hint={gstNote ?? "Price before GST. Used when a shop has no special price."} />
          <Input label="MRP (₹)" inputMode="decimal" value={form.mrp} onChange={set("mrp")} error={errors.mrp} hint={marginNote ?? "Leave empty if not applicable."} />
          <Select label="GST rate" value={form.gstRate} onChange={set("gstRate")} error={errors.gstRate}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
          </Select>
          <Input label="HSN code" inputMode="numeric" value={form.hsnCode} onChange={set("hsnCode")} error={errors.hsnCode} maxLength={8} />
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Ordering</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Input label="Selling unit *" list="unit-options" value={form.unit} onChange={set("unit")} error={errors.unit} hint="What 1 quantity means" maxLength={20} />
            <datalist id="unit-options">{PRODUCT_UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          </div>
          <Input label="Pack size" inputMode="numeric" value={form.packSize} onChange={set("packSize")} error={errors.packSize} hint={form.packSize ? `${form.unit} of ${form.packSize}` : "Items per unit (optional)"} />
          <Input label="Minimum order qty *" inputMode="numeric" value={form.minOrderQty} onChange={set("minOrderQty")} error={errors.minOrderQty} hint={`In ${form.unit || "units"}`} />
          {isNew && (
            <Input label="Opening stock" inputMode="numeric" value={form.stockQuantity} onChange={set("stockQuantity")} error={errors.stockQuantity} hint={`In ${form.unit || "units"}`} />
          )}
        </div>
        <Checkbox label="Active" description="Active products are visible to retailers and can be ordered." checked={form.isActive} onChange={set("isActive")} />
      </Card>

      <div className="flex gap-3">
        <Button type="submit" size="lg" loading={saving}>{isNew ? "Create product" : "Save changes"}</Button>
        <Button variant="secondary" size="lg" href="/admin/products">{isNew ? "Cancel" : "Back to products"}</Button>
      </div>
    </form>
  );
}
