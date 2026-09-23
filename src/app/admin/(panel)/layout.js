import AdminShell from "@/components/admin/AdminShell";

// Admin panel layout. The (panel) route group lets /admin/login live outside
// this sidebar layout (added in Phase 2) while every other /admin page uses it.
export const metadata = { title: { default: "Admin", template: "%s · Admin" } };

export default function AdminPanelLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
