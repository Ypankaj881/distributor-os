import Link from "next/link";
import Card from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import OrderTimeline from "@/components/orders/OrderTimeline";
import ShareOrderButton from "@/components/shop/ShareOrderButton";
import CancelOrderButton from "@/components/shop/CancelOrderButton";
import ReorderButton from "@/components/shop/ReorderButton";
import { ORDER_STATUS } from "@/lib/constants";
import { requireRetailerPage } from "@/server/auth/guards";
import { formatINR } from "@/lib/money";
import { formatDateTime, formatDate, todayIn } from "@/lib/dates";
import { paymentState } from "@/lib/payments";
import Badge from "@/components/ui/Badge";
import { PAYMENT_MODES } from "@/lib/constants";
import { loadShopOrderOr404 } from "../loadOrder";

export const metadata = { title: "Order details" };

export default async function ShopOrderPage({ params }) {
  const auth = await requireRetailerPage();
  const { id } = await params;
  const order = await loadShopOrderOr404(auth, id);
  const tz = auth.company.settings?.timezone ?? "Asia/Kolkata";
  const pay = paymentState(order, todayIn(tz));
  const a = order.shippingAddress;
  const address = a ? [a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", ") : "";

  return (
    <div className="space-y-4">
      <Link href="/orders" className="inline-block text-sm text-slate-500">← My orders</Link>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Order {order.orderNumber}</h1>
          <p className="text-sm text-slate-500">Placed {formatDateTime(order.createdAt, tz)}</p>
        </div>
        <StatusBadge status={order.status} className="text-sm" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {order.items.map((i) => {
                const changed = i.confirmedQty != null && i.confirmedQty !== i.orderedQty;
                return (
                  <li key={i.id} className="flex justify-between gap-3 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-500">{i.brandName}</p>
                      <p className="font-medium">{i.name}</p>
                      <p className="text-slate-500">
                        {changed ? (
                          <>
                            <span className="line-through">{i.orderedQty}</span>{" "}
                            <span className="font-medium text-amber-700">{i.confirmedQty} {i.unit} confirmed</span>
                          </>
                        ) : (
                          `${i.orderedQty} ${i.unit}`
                        )}{" "}
                        × {formatINR(i.unitPrice)}
                      </p>
                    </div>
                    <p className="shrink-0 font-medium tabular-nums">{formatINR(i.taxable)}</p>
                  </li>
                );
              })}
            </ul>
            <dl className="space-y-1 border-t border-slate-100 bg-slate-50 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{formatINR(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">GST{order.pricesIncludeGst ? " (included)" : ""}</dt><dd className="tabular-nums">{formatINR(order.gstTotal)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(order.grandTotal)}</dd></div>
            </dl>
          </Card>

          {(address || order.notes) && (
            <Card className="space-y-3 p-4 text-sm">
              {address && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Deliver to</p>
                  <p className="mt-0.5">{address}</p>
                </div>
              )}
              {order.notes && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Your note</p>
                  <p className="mt-0.5 whitespace-pre-line">{order.notes}</p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* On phones the status comes first — it's why the shop opened the order. */}
        <div className="order-first space-y-4 lg:order-none">
          <Card className="p-4">
            <h2 className="mb-3 font-semibold">Status</h2>
            <OrderTimeline status={order.status} timeline={order.timeline} timeZone={tz} />
          </Card>
          {pay.key !== "NA" && order.status !== "NEW" && (
            <Card className="space-y-2 p-4 text-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Payment</h2>
                <Badge tone={pay.tone}>{pay.label}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-y-1">
                <dt className="text-slate-500">Paid</dt><dd className="text-right tabular-nums">{formatINR(pay.paid)}</dd>
                <dt className="font-medium">Balance</dt><dd className={`text-right font-semibold tabular-nums ${pay.key === "OVERDUE" ? "text-red-600" : ""}`}>{formatINR(pay.balance)}</dd>
                <dt className="text-slate-500">Due</dt><dd className="text-right">{pay.dueOn ? formatDate(`${pay.dueOn}T12:00:00Z`, "UTC") : "On delivery"}</dd>
              </dl>
              {order.payments.length > 0 && (
                <ul className="border-t border-slate-100 pt-2 text-xs text-slate-500">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>{formatDate(`${p.paidOn}T12:00:00Z`, "UTC")} · {PAYMENT_MODES[p.mode] ?? p.mode}</span>
                      <span className="tabular-nums">{formatINR(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          <ReorderButton orderId={order.id} />
          <ShareOrderButton order={order} distributorPhone={auth.company.phone} className="w-full" />
          {order.status === ORDER_STATUS.NEW && <CancelOrderButton orderId={order.id} />}
        </div>
      </div>
    </div>
  );
}
