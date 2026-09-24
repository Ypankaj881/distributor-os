import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/server/auth/guards";
import { getNewOrdersSummary } from "@/server/services/adminOrderService";

// Admin panel layout. The (panel) route group keeps /admin/login outside this
// sidebar layout while every other /admin page uses it.
export const metadata = { title: { default: "Admin", template: "%s · Admin" } };

export default async function AdminPanelLayout({ children }) {
  const auth = await requireAdminPage();
  const { newCount } = await getNewOrdersSummary(auth.companyId);
  return (
    <AdminShell companyName={auth.company.name} userName={auth.name} initialNewCount={newCount}>
      {children}
    </AdminShell>
  );
}
