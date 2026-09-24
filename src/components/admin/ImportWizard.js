"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import { api } from "@/lib/apiClient";
import { toCsv } from "@/lib/csv";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/components/ui/cn";

const TYPES = {
  products: {
    label: "Products",
    required: ["brand", "name", "sku", "price"],
    optional: ["unit", "pack_size", "mrp", "gst", "min_qty", "stock", "hsn", "description", "image_url", "active"],
    notes: [
      "Prices in rupees (₹50 or 50.50). GST as 0, 5, 12, 18 or 28.",
      "Same SKU as an existing product → that product is updated. Stock is only used for NEW products.",
      "Brands that don't exist yet are created.",
    ],
    example: [
      ["brand", "name", "sku", "unit", "pack_size", "mrp", "price", "gst", "min_qty", "stock"],
      ["Natraj", "HB Pencil", "NT-HB", "box", "10", "60", "50", "12", "5", "400"],
      ["Bellavita", "CEO Perfume 100ml", "BV-CEO", "bottle", "", "999", "650", "18", "2", "120"],
    ],
    done: { href: "/admin/products", label: "Go to products" },
  },
  customers: {
    label: "Shops",
    required: ["shop_name", "phone"],
    optional: ["owner_name", "email", "gstin", "code", "address", "area", "city", "state", "pincode", "credit_limit", "payment_terms"],
    notes: [
      "Each new shop gets a login (its mobile number + a generated password) — you'll get the list to share.",
      "A mobile number that already exists → that shop's details are updated; its password is not changed.",
      "Leave code empty to number shops automatically (C0001, C0002…).",
    ],
    example: [
      ["shop_name", "owner_name", "phone", "city", "pincode", "gstin", "credit_limit", "payment_terms"],
      ["Sharma General Store", "Rajesh Sharma", "9876543210", "Nagpur", "440001", "", "50000", "15 days"],
      ["Gupta Stationers", "Anil Gupta", "9876500000", "Nagpur", "440002", "", "", ""],
    ],
    done: { href: "/admin/customers", label: "Go to customers" },
  },
  prices: {
    label: "Special prices",
    required: ["customer", "sku", "price"],
    optional: ["from", "to"],
    notes: [
      "customer = the shop's customer code (C0001) or its mobile number.",
      "Price in rupees, before GST, not above MRP.",
      "from / to (optional) as YYYY-MM-DD — empty = starts now, no end date.",
    ],
    example: [
      ["customer", "sku", "price", "from", "to"],
      ["C0001", "NT-HB", "46", "", ""],
      ["9876500000", "BV-CEO", "620", "", ""],
    ],
    done: { href: "/admin/customers", label: "Go to customers" },
  },
};

const ACTION_TONE = { create: "green", update: "blue", error: "red", skip: "gray" };

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportWizard() {
  const [type, setType] = useState("products");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [check, setCheck] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const t = TYPES[type];

  function reset(nextType = type) {
    setType(nextType);
    setText("");
    setFileName("");
    setCheck(null);
    setResult(null);
    setError(null);
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 900_000) return setError("File is too large (max ~900 KB, about 2000 rows). Split it into parts.");
    setFileName(file.name);
    setText(await file.text());
    setCheck(null);
    setResult(null);
    setError(null);
  }

  async function run(dryRun) {
    setBusy(dryRun ? "check" : "import");
    setError(null);
    const res = await api.post(`/api/admin/import/${type}`, { text, dryRun });
    setBusy(null);
    if (!res.ok) return setError(res.error.fields?.file ?? res.error.fields?.text ?? res.error.message);
    if (dryRun) setCheck(res.data);
    else {
      setResult(res.data);
      setCheck(null);
    }
  }

  const shown = result ?? check;
  const importable = check ? check.summary.create + check.summary.update : 0;
  // Errors first, otherwise in spreadsheet order.
  const rows = shown ? [...shown.rows].sort((a, b) => (b.action === "error") - (a.action === "error") || a.row - b.row) : [];

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-slate-200">
        {Object.entries(TYPES).map(([key, v]) => (
          <button
            key={key}
            type="button"
            onClick={() => reset(key)}
            className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-medium", type === key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">1. Add your {t.label.toLowerCase()}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
              Choose CSV file
              <input type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={onFile} />
            </label>
            <span className="text-sm text-slate-500">{fileName || "or paste rows copied from Excel below"}</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setFileName(""); setCheck(null); setResult(null); }}
            rows={8}
            spellCheck={false}
            placeholder={"Paste here — select the cells in Excel (including the header row), Ctrl+C, then Ctrl+V."}
            className="block w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run(true)} loading={busy === "check"} disabled={!text.trim() || Boolean(busy)}>2. Check rows</Button>
            {check && (
              <Button variant={check.summary.error ? "secondary" : "primary"} onClick={() => run(false)} loading={busy === "import"} disabled={!importable || Boolean(busy)}>
                3. Import {importable} row{importable === 1 ? "" : "s"}{check.summary.error ? ` (skip ${check.summary.error} with errors)` : ""}
              </Button>
            )}
          </div>
        </Card>

        <Card className="space-y-3 p-5 text-sm">
          <h2 className="font-semibold">Columns</h2>
          <p><span className="font-medium">Required:</span> {t.required.join(", ")}</p>
          <p><span className="font-medium">Optional:</span> {t.optional.join(", ")}</p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600">{t.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          <p className="text-slate-500">Header names are flexible (e.g. &quot;Product Name&quot;, &quot;Selling Price&quot;, &quot;Mobile&quot; work too).</p>
          <Button variant="secondary" size="sm" onClick={() => download(`${type}-template.csv`, toCsv(t.example))}>Download template</Button>
        </Card>
      </div>

      {result && (
        <Alert tone={result.summary.error ? "warning" : "success"}>
          Imported: {result.summary.create} created, {result.summary.update} updated
          {result.summary.error ? `, ${result.summary.error} skipped because of errors (listed below)` : ""}.{" "}
          <a href={t.done.href} className="font-medium underline">{t.done.label}</a>
        </Alert>
      )}

      {result?.logins?.length > 0 && (
        <Card className="space-y-3 border-emerald-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Login details for {result.logins.length} new shop{result.logins.length === 1 ? "" : "s"}</h2>
              <p className="text-sm text-slate-500">Download or copy now — passwords are stored encrypted and can&apos;t be shown again (you can set new ones later).</p>
            </div>
            <Button
              size="sm"
              onClick={() => download("shop-logins.csv", toCsv([["shop", "code", "mobile", "password", "login link"], ...result.logins.map((l) => [l.shopName, l.customerCode, l.phone, l.password, `${window.location.origin}/login`])]))}
            >
              Download login list
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-1">Shop</th><th>Mobile</th><th>Password</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {result.logins.map((l) => (
                <tr key={l.phone}><td className="py-1.5">{l.shopName} <span className="text-xs text-slate-400">{l.customerCode}</span></td><td>{formatPhone(l.phone)}</td><td className="font-mono">{l.password}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {shown && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm">
            <span className="font-medium">{shown.summary.total} rows:</span>
            {shown.summary.create > 0 && <Badge tone="green">{shown.summary.create} new</Badge>}
            {shown.summary.update > 0 && <Badge tone="blue">{shown.summary.update} update</Badge>}
            {shown.summary.error > 0 && <Badge tone="red">{shown.summary.error} with errors</Badge>}
            {shown.summary.newBrands > 0 && <Badge tone="amber">{shown.summary.newBrands} new brand{shown.summary.newBrands === 1 ? "" : "s"}</Badge>}
            {!result && <span className="text-slate-500">Nothing is saved until you click Import.</span>}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2">Row</th><th className="px-4 py-2">Item</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 300).map((r) => (
                <tr key={r.row} className={r.action === "error" ? "bg-red-50/40" : ""}>
                  <td className="px-4 py-2 tabular-nums text-slate-500">{r.row}</td>
                  <td className="px-4 py-2 font-medium">{r.key || "—"}</td>
                  <td className="px-4 py-2"><Badge tone={ACTION_TONE[r.action]}>{r.action}</Badge></td>
                  <td className="px-4 py-2 text-slate-600">{r.messages.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 300 && <p className="px-4 py-2 text-xs text-slate-500">Showing the first 300 rows (errors first).</p>}
        </Card>
      )}
    </div>
  );
}
