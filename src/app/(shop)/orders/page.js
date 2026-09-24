import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import Icon from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/Badge";
import { requireRetailerPage } from "@/server/auth/guards";
import { listShopOrders } from "@/server/services/orderService";
import { orderListQuerySchema } from "@/server/validators/order";
import { formatINR } from "@/lib/money";
import { formatDate, todayIn } from "@/lib/dates";
import PaymentBadge from "@/components/orders/PaymentBadge";

export const metadata = { title: "My orders" };

export default async function MyOrdersPage({ searchParams }) {
  const auth = await requireRetailerPage();
  const query = orderListQuerySchema.parse(await searchParams);
  const { items, meta } = await listShopOrders(auth.companyId, auth.customerId, query);
  const tz = auth.company.settings?.timezone ?? "Asia/Kolkata";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">My orders</h1>

      {items.length === 0 ? (
        <Card>
          <EmptyState icon="orders" title="No orders yet" description="Orders you place will appear here with their status." action={<Button href="/products">Start ordering</Button>} />
        </Card>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{o.orderNumber}</p>
                      <StatusBadge status={o.status} />
                      {o.status !== "NEW" && <PaymentBadge order={o} today={todayIn(tz)} />}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDate(o.createdAt, tz)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}</p>
                    <p className="mt-1 truncate text-sm text-slate-600">{o.preview.join(", ")}{o.itemCount > 3 ? "…" : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-semibold tabular-nums">{formatINR(o.grandTotal)}</span>
                    <Icon name="chevronRight" className="size-5 text-slate-400" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination basePath="/orders" page={meta.page} totalPages={meta.totalPages} />
        </>
      )}
    </div>
  );
}
