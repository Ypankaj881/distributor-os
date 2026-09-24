import { notFound } from "next/navigation";
import PrintButton from "@/components/admin/PrintButton";
import { requireAdminPage } from "@/server/auth/guards";
import { getAdminOrder } from "@/server/services/adminOrderService";
import { getCompanySettings } from "@/server/services/companyService";
import { AppError } from "@/server/http/errors";
import { formatINR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

export const metadata = { title: "Packing slip" };

const join = (a) => (a ? [a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", ") : "");

// Printable packing slip / delivery note (A4). Lives outside the admin sidebar
// layout so it prints clean. NOT a tax invoice — V1 does no invoicing.
export default async function PackingSlipPage({ params, searchParams }) {
  const auth = await requireAdminPage();
  const { id } = await params;
  const { auto } = await searchParams;

  let order;
  try {
    order = await getAdminOrder(auth.companyId, id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  const company = await getCompanySettings(auth.companyId);
  const tz = company.settings.timezone;
  const supplied = (i) => i.confirmedQty ?? i.orderedQty;
  const confirmed = order.items.some((i) => i.confirmedQty != null);
  const totalUnits = order.items.reduce((s, i) => s + supplied(i), 0);

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-[13px] leading-snug text-slate-900 print:max-w-none print:p-0">
      <style>{"@page { size: A4; margin: 14mm; } @media print { body { background: white; } }"}</style>
      <PrintButton auto={auto === "1"} backHref={`/admin/orders/${order.id}`} />

      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-3">
        <div>
          <p className="text-lg font-bold">{company.name}</p>
          {join(company.address) && <p>{join(company.address)}</p>}
          <p>
            {company.phone && <>Phone {formatPhone(company.phone)}</>}
            {company.phone && company.gstin && " · "}
            {company.gstin && <>GSTIN {company.gstin}</>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold uppercase tracking-wide">Packing slip</p>
          <p className="text-lg font-bold">{order.orderNumber}</p>
          <p>Ordered {formatDateTime(order.createdAt, tz)}</p>
          <p>Status: {ORDER_STATUS_LABELS[order.status]}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 border-b border-slate-300 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Shop</p>
          <p className="font-semibold">{order.customer.shopName}</p>
          <p>{order.customer.ownerName}{order.customer.ownerName && " · "}{formatPhone(order.customer.phone)}</p>
          <p>Code {order.customer.customerCode}{order.customer.gstin && ` · GSTIN ${order.customer.gstin}`}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Deliver to</p>
          <p>{join(order.shippingAddress) || "—"}</p>
        </div>
      </section>

      {order.notes && (
        <p className="border-b border-slate-300 py-2"><span className="font-semibold">Shop&apos;s note:</span> {order.notes}</p>
      )}

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-900 text-left text-[11px] uppercase tracking-wide">
            <th className="py-1.5 pr-2">#</th>
            <th className="py-1.5 pr-2">Product</th>
            <th className="py-1.5 pr-2 text-right">Ordered</th>
            {confirmed && <th className="py-1.5 pr-2 text-right">Supplied</th>}
            <th className="py-1.5 pr-2 text-right">Rate</th>
            <th className="py-1.5 pr-2 text-right">GST</th>
            <th className="py-1.5 text-right">Amount</th>
            <th className="w-10 py-1.5 text-center print:table-cell">✓</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i, n) => (
            <tr key={i.id} className="border-b border-slate-200 align-top" style={{ breakInside: "avoid" }}>
              <td className="py-1.5 pr-2">{n + 1}</td>
              <td className="py-1.5 pr-2">
                <span className="font-medium">{i.name}</span>
                <span className="block text-[11px] text-slate-500">{i.brandName} · {i.sku}{i.packSize ? ` · ${i.unit} of ${i.packSize}` : ""}</span>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{i.orderedQty} {i.unit}</td>
              {confirmed && <td className={`py-1.5 pr-2 text-right font-semibold tabular-nums ${i.cancelledQty > 0 ? "underline" : ""}`}>{supplied(i)}</td>}
              <td className="py-1.5 pr-2 text-right tabular-nums">{formatINR(i.unitPrice)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{i.gstRate}%</td>
              <td className="py-1.5 text-right tabular-nums">{formatINR(i.taxable)}</td>
              <td className="py-1.5 text-center"><span className="inline-block size-3.5 border border-slate-500" /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-between gap-6" style={{ breakInside: "avoid" }}>
        <p className="text-slate-600">{order.items.length} products · {totalUnits} units{confirmed ? " (supplied)" : ""}</p>
        <dl className="w-64 space-y-0.5">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatINR(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>GST{order.pricesIncludeGst ? " (included)" : ""}</dt><dd className="tabular-nums">{formatINR(order.gstTotal)}</dd></div>
          <div className="flex justify-between border-t-2 border-slate-900 pt-1 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{formatINR(order.grandTotal)}</dd></div>
          <div className="flex justify-between text-slate-600"><dt>Payment</dt><dd>{order.paymentStatus.toLowerCase()}</dd></div>
        </dl>
      </div>

      <footer className="mt-12 grid grid-cols-2 gap-10" style={{ breakInside: "avoid" }}>
        <div className="border-t border-slate-400 pt-1">Packed by (name &amp; sign)</div>
        <div className="border-t border-slate-400 pt-1">Received by — shop stamp &amp; sign</div>
      </footer>
      <p className="mt-6 text-center text-[11px] text-slate-500">This is a packing slip / delivery note, not a tax invoice.</p>
    </div>
  );
}
