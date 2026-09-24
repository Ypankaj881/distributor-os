import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import AdminOrderBuilder from "@/components/admin/AdminOrderBuilder";
import { requireAdminPage } from "@/server/auth/guards";
import { getCustomer } from "@/server/services/customerService";

export const metadata = { title: "New order" };

// Distributor places an order for a shop — e.g. an order received by phone or WhatsApp.
export default async function NewAdminOrderPage({ searchParams }) {
  const auth = await requireAdminPage();
  const { customerId } = await searchParams;

  let initialShop = null;
  if (customerId) {
    try {
      const c = await getCustomer(auth.companyId, customerId);
      if (c.isActive) initialShop = { id: c.id, shopName: c.shopName, customerCode: c.customerCode, phone: c.phone, city: c.city };
    } catch {
      // unknown / other company's id → just start without a preselected shop
    }
  }

  return (
    <>
      <Link href="/admin/orders" className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">← Orders</Link>
      <PageHeader title="New order for a shop" description="For orders received by phone or WhatsApp. The shop's own prices, stock and minimum quantities apply." />
      <AdminOrderBuilder initialShop={initialShop} />
    </>
  );
}
