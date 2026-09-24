import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import CustomerForm from "@/components/admin/CustomerForm";
import CustomerAccessCard from "@/components/admin/CustomerAccessCard";
import { requireAdminPage } from "@/server/auth/guards";
import { countSpecialPrices } from "@/server/services/pricingService";
import { recentOrdersForCustomer } from "@/server/services/adminOrderService";
import { customerBalance } from "@/server/services/paymentService";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { daysBetween } from "@/lib/payments";
import { todayIn } from "@/lib/dates";
import { loadCustomerOr404 } from "./loadCustomer";

export const metadata = { title: "Customer" };

export default async function CustomerDetailsPage({ params }) {
  const auth = await requireAdminPage();
  const { id } = await params;
  const customer = await loadCustomerOr404(auth.companyId, id);
  const timeZone = auth.company.settings?.timezone ?? "Asia/Kolkata";
  const [specialCount, recent, balance] = await Promise.all([
    countSpecialPrices(auth.companyId, customer.id),
    recentOrdersForCustomer(auth.companyId, customer.id),
    customerBalance(auth.companyId, customer.id, { timeZone }),
  ]);
  const today = todayIn(timeZone);
  const creditDays = customer.creditDays ?? auth.company.settings?.defaultCreditDays ?? 0;
  const usedPct = customer.creditLimit > 0 ? Math.min(100, Math.round((balance.outstanding / customer.creditLimit) * 100)) : null;

  return (
    <>
      <Link href="/admin/customers" className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">← Customers</Link>
      <PageHeader
        title={customer.shopName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{customer.customerCode}</span>
            {!customer.isActive && <Badge tone="red">Inactive</Badge>}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <CustomerForm customer={customer} />
        <div className="space-y-6">
          <Card className="space-y-3 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Balance</h2>
              {balance.orders > 0 && (
                <Link href={`/admin/orders?status=all&payment=due&customerId=${customer.id}`} className="text-sm font-medium text-brand-600 hover:underline">Unpaid orders</Link>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-slate-500">Outstanding</dt>
              <dd className="text-right font-semibold tabular-nums">{formatINR(balance.outstanding)}</dd>
              <dt className="text-slate-500">Overdue</dt>
              <dd className={`text-right tabular-nums ${balance.overdue > 0 ? "font-semibold text-red-600" : ""}`}>
                {formatINR(balance.overdue)}{balance.overdueOrders > 0 && ` (${balance.overdueOrders})`}
              </dd>
              {balance.oldestDue && (
                <>
                  <dt className="text-slate-500">Oldest overdue</dt>
                  <dd className="text-right text-red-600">{daysBetween(balance.oldestDue, today)} days</dd>
                </>
              )}
              <dt className="text-slate-500">Credit period</dt>
              <dd className="text-right">{creditDays === 0 ? "Pay on delivery" : `${creditDays} days`}{customer.creditDays == null ? " (default)" : ""}</dd>
            </dl>
            {usedPct != null && (
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Credit limit used</span><span>{usedPct}% of {formatINR(customer.creditLimit)}</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${usedPct >= 100 ? "bg-red-500" : usedPct >= 80 ? "bg-amber-500" : "bg-brand-500"}`} style={{ width: `${usedPct}%` }} /></div>
              </div>
            )}
          </Card>
          <CustomerAccessCard customer={customer} timeZone={timeZone} />
          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">Pricing</h2>
            <p className="text-sm text-slate-600">
              {specialCount === 0
                ? "Pays the default price for all products."
                : `Has special prices on ${specialCount} product${specialCount === 1 ? "" : "s"}. Everything else is at the default price.`}
            </p>
            <Button variant="secondary" className="w-full" href={`/admin/customers/${customer.id}/pricing`}>
              Manage prices
            </Button>
          </Card>
          <Card className="p-5">
            {customer.isActive && (
              <Button className="mb-4 w-full" href={`/admin/orders/new?customerId=${customer.id}`}>Create order for this shop</Button>
            )}
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-semibold">Recent orders</h2>
              {recent.total > 0 && (
                <Link href={`/admin/orders?status=all&customerId=${customer.id}`} className="text-sm font-medium text-brand-600 hover:underline">All {recent.total}</Link>
              )}
            </div>
            {recent.items.length === 0 ? (
              <p className="text-sm text-slate-500">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.items.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:text-brand-700">
                      <span>
                        <span className="font-medium">{o.orderNumber}</span>
                        <span className="block text-xs text-slate-500">{formatDate(o.createdAt, timeZone)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{formatINR(o.grandTotal)}</span>
                        <StatusBadge status={o.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
