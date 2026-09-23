import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { ORDER_STATUS } from "@/lib/constants";
import { requireAdminPage } from "@/server/auth/guards";

export const metadata = { title: "Dashboard" };

const PLACEHOLDER_STATS = ["Today's orders", "Pending orders", "Today's sales", "This month's sales"];

// Placeholder dashboard — real numbers arrive in Phase 10.
export default async function AdminDashboardPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Dashboard" description="Overview of orders and sales." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {PLACEHOLDER_STATS.map((label) => (
          <Card key={label} className="p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-300">—</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <p className="text-sm font-medium text-slate-900">Order status badges</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.values(ORDER_STATUS).map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </Card>
    </>
  );
}
