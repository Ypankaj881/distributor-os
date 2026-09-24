import { notFound } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import OrderTimeline from "@/components/orders/OrderTimeline";
import ConfirmOrderPanel from "@/components/admin/ConfirmOrderPanel";
import OrderActions from "@/components/admin/OrderActions";
import PaymentStatusControl from "@/components/admin/PaymentStatusControl";
import { requireAdminPage } from "@/server/auth/guards";
import { getAdminOrder } from "@/server/services/adminOrderService";
import { AppError } from "@/server/http/errors";
import { formatINR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { statusMessageText, whatsappUrl } from "@/lib/orderShare";
import { ORDER_STATUS } from "@/lib/constants";

export const metadata = { title: "Order" };

function ItemsTable({ order }) {
  const confirmed = order.items.some((i) => i.confirmedQty != null);
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3 text-right">Ordered</th>
            {confirmed && <th className="px-4 py-3 text-right">Supplied</th>}
            <th className="hidden px-4 py-3 text-right sm:table-cell">Rate</th>
            <th className="px-4 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {order.items.map((i) => (
            <tr key={i.id}>
              <td className="px-4 py-3">
                <p className="font-medium">{i.name}</p>
                <p className="text-xs text-slate-500">{i.brandName} · <span className="font-mono">{i.sku}</span> · GST {i.gstRate}%</p>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{i.orderedQty} {i.unit}</td>
              {confirmed && (
                <td className={`px-4 py-3 text-right tabular-nums ${i.cancelledQty > 0 ? "font-semibold text-amber-700" : ""}`}>{i.confirmedQty}</td>
              )}
              <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{formatINR(i.unitPrice)}</td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">{formatINR(i.taxable)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto max-w-xs space-y-1 border-t border-slate-100 p-4 text-sm">
        <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{formatINR(order.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">GST{order.pricesIncludeGst ? " (included)" : ""}</dt><dd className="tabular-nums">{formatINR(order.gstTotal)}</dd></div>
        <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(order.grandTotal)}</dd></div>
      </dl>
    </Card>
  );
}

export default async function AdminOrderPage({ params }) {
  const auth = await requireAdminPage();
  const { id } = await params;
  let order;
  try {
    order = await getAdminOrder(auth.companyId, id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  const tz = auth.company.settings?.timezone ?? "Asia/Kolkata";
  const a = order.shippingAddress;
  const address = a ? [a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", ") : "";
  const isNew = order.status === ORDER_STATUS.NEW;

  return (
    <>
      <Link href="/admin/orders" className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">← Orders</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Order {order.orderNumber}</h1>
            <StatusBadge status={order.status} className="text-sm" />
            {order.source !== "PORTAL" && <Badge>{order.source.toLowerCase()}</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">Placed {formatDateTime(order.createdAt, tz)} · {order.items.length} items · {formatINR(order.grandTotal)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-6">
          {isNew ? <ConfirmOrderPanel order={order} /> : <ItemsTable order={order} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="space-y-1 p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Shop</p>
              <Link href={`/admin/customers/${order.customer.id}`} className="font-medium text-brand-700 hover:underline">{order.customer.shopName}</Link>
              <p className="text-slate-600">{order.customer.ownerName}{order.customer.ownerName && " · "}<span className="font-mono">{order.customer.customerCode}</span></p>
              <a href={`tel:+91${order.customer.phone}`} className="block text-slate-600 hover:text-brand-700">{formatPhone(order.customer.phone)}</a>
              {order.customer.gstin && <p className="font-mono text-xs text-slate-500">GSTIN {order.customer.gstin}</p>}
            </Card>
            <Card className="space-y-1 p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Deliver to</p>
              <p>{address || <span className="text-slate-400">No address given</span>}</p>
              {order.notes && (
                <>
                  <p className="pt-2 text-xs uppercase tracking-wide text-slate-500">Shop&apos;s note</p>
                  <p className="whitespace-pre-line rounded-md bg-amber-50 p-2 text-amber-900">{order.notes}</p>
                </>
              )}
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <OrderActions order={order} />
          <Card className="space-y-4 p-4">
            <PaymentStatusControl orderId={order.id} value={order.paymentStatus} />
            <a
              href={whatsappUrl(statusMessageText(order, auth.company.name), order.customer.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center justify-center rounded-lg bg-[#25D366] text-sm font-medium text-white hover:bg-[#1ebe5b]"
            >
              Send update on WhatsApp
            </a>
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 font-semibold">History</h2>
            <OrderTimeline status={order.status} timeline={order.timeline} timeZone={tz} showActor />
          </Card>
        </div>
      </div>
    </>
  );
}
