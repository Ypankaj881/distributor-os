import Link from "next/link";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import SalesChart from "@/components/admin/SalesChart";
import { requireAdminPage } from "@/server/auth/guards";
import { getDashboard } from "@/server/services/dashboardService";
import { formatINR } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Dashboard" };

function Stat({ label, value, hint, href }) {
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-200">{body}</Link>
  ) : (
    <Card className="p-4">{body}</Card>
  );
}

const PIPELINE = [
  { key: "NEW", label: "New", hint: "Waiting for you" },
  { key: "CONFIRMED", label: "Confirmed", hint: "To pack" },
  { key: "PACKED", label: "Packed", hint: "To dispatch" },
  { key: "DISPATCHED", label: "Dispatched", hint: "On the way" },
];

export default async function AdminDashboardPage() {
  const auth = await requireAdminPage();
  const tz = auth.company.settings?.timezone ?? "Asia/Kolkata";
  const d = await getDashboard(auth.companyId, auth.company.settings);

  return (
    <>
      <PageHeader title="Dashboard" description={formatDate(new Date(), tz)} />

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Today's orders" value={d.today.orders} href="/admin/orders?status=all" />
        <Stat label="Today's sales" value={formatINR(d.today.sales)} />
        <Stat label="This month's sales" value={formatINR(d.month.sales)} hint={`${d.month.orders} orders`} />
        <Stat label="Active customers" value={d.activeCustomers} href="/admin/customers?status=active" />
        <Stat label="Active products" value={d.activeProducts} href="/admin/products?status=active" />
      </div>

      {/* Order pipeline — current counts; tap to open that tab */}
      <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Orders in progress</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {PIPELINE.map((p) => {
          const n = d.pipeline[p.key];
          const attention = p.key === "NEW" && n > 0;
          return (
            <Link
              key={p.key}
              href={`/admin/orders?status=${p.key}`}
              className={cn("rounded-xl border bg-white p-4 hover:border-brand-200", attention ? "border-amber-300 bg-amber-50" : "border-slate-200")}
            >
              <p className={cn("text-sm", attention ? "font-medium text-amber-900" : "text-slate-500")}>{p.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{n}</p>
              <p className="text-xs text-slate-500">{p.hint}</p>
            </Link>
          );
        })}
        <Link href="/admin/orders?status=DELIVERED" className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-200 sm:col-span-1">
          <p className="text-sm text-slate-500">Delivered</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{d.month.delivered}</p>
          <p className="text-xs text-slate-500">Ordered this month</p>
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold">Daily sales</h2>
            <p className="text-xs text-slate-500">Last 14 days · excl. cancelled</p>
          </div>
          <SalesChart days={d.days} />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Low stock</h2>
            {d.lowStock.count > 0 && <Link href="/admin/products?stock=low" className="text-sm font-medium text-brand-600 hover:underline">All {d.lowStock.count}</Link>}
          </div>
          {d.lowStock.items.length === 0 ? (
            <p className="text-sm text-slate-500">All active products have more than {d.lowStock.threshold} in stock.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.lowStock.items.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-brand-700">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="font-mono text-xs text-slate-500">{p.sku}</span>
                    </span>
                    <span className={cn("shrink-0 text-sm font-semibold tabular-nums", p.stockQuantity <= 0 ? "text-red-600" : "text-amber-700")}>
                      {p.stockQuantity <= 0 ? "Out" : `${p.stockQuantity} ${p.unit}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-baseline justify-between px-5 py-4">
          <h2 className="font-semibold">Latest orders</h2>
          <Link href="/admin/orders?status=all" className="text-sm font-medium text-brand-600 hover:underline">View all</Link>
        </div>
        {d.recentOrders.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">No orders yet. When shops order, they&apos;ll show up here.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {d.recentOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="font-semibold">{o.orderNumber}</span>
                    <span className="text-slate-600"> · {o.shopName}</span>
                    <span className="block text-xs text-slate-500">{formatDateTime(o.createdAt, tz)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums">{formatINR(o.grandTotal)}</span>
                    <StatusBadge status={o.status} />
                    <Icon name="chevronRight" className="hidden size-4 text-slate-400 sm:block" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
