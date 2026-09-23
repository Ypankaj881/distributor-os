import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import PriceGrid from "@/components/admin/PriceGrid";
import { requireAdminPage } from "@/server/auth/guards";
import { listCustomerPriceRows } from "@/server/services/pricingService";
import { listBrandOptions } from "@/server/services/brandService";
import { priceListQuerySchema } from "@/server/validators/pricing";
import { todayIn } from "@/lib/dates";
import { loadCustomerOr404 } from "../loadCustomer";

export const metadata = { title: "Customer pricing" };

export default async function CustomerPricingPage({ params, searchParams }) {
  const auth = await requireAdminPage();
  const { id } = await params;
  const customer = await loadCustomerOr404(auth.companyId, id);
  const query = priceListQuerySchema.parse(await searchParams);
  const timeZone = auth.company.settings?.timezone ?? "Asia/Kolkata";

  const [{ rows, meta }, brands] = await Promise.all([
    listCustomerPriceRows(auth.companyId, customer.id, query),
    listBrandOptions(auth.companyId),
  ]);

  return (
    <>
      <Link href={`/admin/customers/${customer.id}`} className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← {customer.shopName}
      </Link>
      <PageHeader
        title={`Prices for ${customer.shopName}`}
        description="Special prices override the default price for this shop only. Prices are before GST."
      />
      <PriceGrid
        customer={{ id: customer.id, shopName: customer.shopName }}
        rows={rows}
        meta={meta}
        filters={{ q: query.q, brandId: query.brandId, view: query.view }}
        brands={brands}
        today={todayIn(timeZone)}
        timeZone={timeZone}
      />
    </>
  );
}
