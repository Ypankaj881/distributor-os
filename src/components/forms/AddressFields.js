"use client";

import Input from "@/components/ui/Input";

export const EMPTY_ADDRESS = { line1: "", line2: "", landmark: "", city: "", state: "", pincode: "" };

// errors: the form's field errors; prefix: "billingAddress" / "shippingAddress"
export default function AddressFields({ value, onChange, errors = {}, prefix, disabled }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  const err = (key) => errors[`${prefix}.${key}`];

  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
      <Input className="sm:col-span-2" label="Address line 1" value={value.line1} onChange={set("line1")} error={err("line1")} maxLength={200} placeholder="Shop no., building, street" />
      <Input className="sm:col-span-2" label="Address line 2" value={value.line2} onChange={set("line2")} error={err("line2")} maxLength={200} placeholder="Area, locality" />
      <Input label="Landmark" value={value.landmark} onChange={set("landmark")} error={err("landmark")} maxLength={120} />
      <Input label="City" value={value.city} onChange={set("city")} error={err("city")} maxLength={80} />
      <Input label="State" value={value.state} onChange={set("state")} error={err("state")} maxLength={80} />
      <Input label="PIN code" inputMode="numeric" value={value.pincode} onChange={set("pincode")} error={err("pincode")} maxLength={6} />
    </fieldset>
  );
}
