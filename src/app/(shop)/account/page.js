import Card from "@/components/ui/Card";
import LogoutButton from "@/components/auth/LogoutButton";
import ChangePasswordCard from "@/components/auth/ChangePasswordCard";
import ProfileCard from "@/components/shop/ProfileCard";
import AddressBook from "@/components/shop/AddressBook";
import { requireRetailerPage } from "@/server/auth/guards";
import { getShopProfile, getShopAddresses } from "@/server/services/customerService";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const auth = await requireRetailerPage();
  const [profile, addresses] = await Promise.all([
    getShopProfile(auth.companyId, auth.customerId),
    getShopAddresses(auth.companyId, auth.customerId),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Account</h1>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <ProfileCard profile={profile} distributorName={auth.company.name} />
          <AddressBook initialAddresses={addresses} />
        </div>
        <div className="space-y-4">
          <ChangePasswordCard />
          <Card className="space-y-1 p-4 text-sm">
            <p className="text-slate-500">Your distributor</p>
            <p className="font-medium">{auth.company.name}</p>
            {auth.company.phone && (
              <a href={`tel:+91${auth.company.phone}`} className="text-brand-700">{formatPhone(auth.company.phone)}</a>
            )}
          </Card>
          <Card className="p-4">
            <LogoutButton redirectTo="/login" className="h-10 text-red-600" />
          </Card>
        </div>
      </div>
    </div>
  );
}
