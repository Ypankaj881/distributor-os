import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import ListFilters from "@/components/admin/ListFilters";
import OrderStatusTabs from "@/components/admin/OrderStatusTabs";
import { requireAdminPage } from "@/server/auth/guards";
import { listAdminOrders, countOrdersByStatus } from "@/server/services/adminOrderService";
import { adminOrderListQuerySchema } from "@/server/validators/order";
import { formatINR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "Orders" };

const PAYMENT_TONE = { UNPAID: "gray", PARTIAL: "amber", PAID: "green" };

export default async function AdminOrdersPage({ searchParams }) {
  const auth = await requireAdminPage();
  const sp = await searchParams;
  // Default tab is "open" (the working list) unless a status is given.
  const query = adminOrderListQuerySchema.parse({ status: "open", ...sp });
  const tz = auth.company.settings?.timezone ?? "Asia/Kolkata";

  const [{ items, meta }, counts] = await Promise.all([
    listAdminOrders(auth.companyId, query, { timeZone: tz }),
    countOrdersByStatus(auth.companyId),
  ]);

  return (
    <>
      <PageHeader title="Orders" description={counts.NEW > 0 ? `${counts.NEW} new order${counts.NEW === 1 ? "" : "s"} waiting for confirmation` : "All caught up."} />

      <div className="mb-4 space-y-3">
        <OrderStatusTabs active={query.status} counts={counts} q={query.q} />
        <ListFilters basePath="/admin/orders" baseParams={{ status: query.status === "open" ? "" : query.status }} search={{ value: query.q ?? "", placeholder: "Search order number, shop or mobile" }} />
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon="orders" title="No orders here" description={query.q ? "Try a different search." : "Orders placed by shops will appear here."} />
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Shop</th>
                  <th className="px-4 py-3">Placed</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-slate-900 hover:text-brand-600">{o.orderNumber}</Link></td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{o.shopName}</p>
                      <p className="font-mono text-xs text-slate-500">{o.customerCode}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(o.createdAt, tz)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.itemCount}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatINR(o.grandTotal)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3"><Badge tone={PAYMENT_TONE[o.paymentStatus]}>{o.paymentStatus.toLowerCase()}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-slate-100 md:hidden">
              {items.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 p-4 active:bg-slate-50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="font-semibold">{o.orderNumber}</span><StatusBadge status={o.status} /></div>
                      <p className="truncate text-sm">{o.shopName}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(o.createdAt, tz)} · {o.itemCount} items</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{formatINR(o.grandTotal)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {items.length > 0 && (
        <div className="mt-4">
          <Pagination basePath="/admin/orders" params={{ status: query.status === "open" ? "" : query.status, q: query.q }} page={meta.page} totalPages={meta.totalPages} total={meta.total} />
        </div>
      )}
    </>
  );
}
