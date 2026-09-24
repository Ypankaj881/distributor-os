import Card from "@/components/ui/Card";
import LogoutButton from "@/components/auth/LogoutButton";
import ChangePasswordCard from "@/components/auth/ChangePasswordCard";
import { requireRetailerPage } from "@/server/auth/guards";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Account" };

// Minimal account page for now (logout lives here on mobile).
// Profile and address management are added in the retailer-screens phase.
export default async function AccountPage() {
  const auth = await requireRetailerPage();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Account</h1>

      <Card className="divide-y divide-slate-100">
        <div className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Name</p>
          <p className="mt-0.5 font-medium">{auth.name}</p>
        </div>
        <div className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Mobile</p>
          <p className="mt-0.5 font-medium">{formatPhone(auth.phone)}</p>
        </div>
        <div className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Distributor</p>
          <p className="mt-0.5 font-medium">{auth.company.name}</p>
        </div>
      </Card>

      <ChangePasswordCard />

      <Card className="p-4">
        <LogoutButton redirectTo="/login" className="h-10 text-red-600" />
      </Card>
    </div>
  );
}
