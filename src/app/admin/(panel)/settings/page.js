import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import SettingsForm from "@/components/admin/SettingsForm";
import ChangePasswordCard from "@/components/auth/ChangePasswordCard";
import { requireAdminPage } from "@/server/auth/guards";
import { getCompanySettings } from "@/server/services/companyService";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const auth = await requireAdminPage();
  const company = await getCompanySettings(auth.companyId);

  return (
    <>
      <PageHeader title="Settings" description="Business details and how orders, prices and stock work." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <SettingsForm company={company} />
        <div className="space-y-6">
          <Card className="space-y-1 p-5 text-sm">
            <h2 className="mb-2 font-semibold">Your account</h2>
            <p>{auth.name}</p>
            {auth.email && <p className="text-slate-500">{auth.email}</p>}
            {auth.phone && <p className="text-slate-500">{auth.phone}</p>}
          </Card>
          <ChangePasswordCard />
        </div>
      </div>
    </>
  );
}
