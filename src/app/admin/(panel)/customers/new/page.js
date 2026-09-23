import PageHeader from "@/components/ui/PageHeader";
import CustomerForm from "@/components/admin/CustomerForm";
import { requireAdminPage } from "@/server/auth/guards";
import { generatePassword } from "@/lib/generatePassword";

export const metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  await requireAdminPage();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add customer" description="Creates the shop and its login (mobile number + password)." />
      <CustomerForm initialPassword={generatePassword()} />
    </div>
  );
}
