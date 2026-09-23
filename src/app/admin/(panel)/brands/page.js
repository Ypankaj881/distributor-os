import PageHeader from "@/components/ui/PageHeader";
import BrandManager from "@/components/admin/BrandManager";
import { requireAdminPage } from "@/server/auth/guards";
import { listBrands } from "@/server/services/brandService";

export const metadata = { title: "Brands" };

// Server Component: reads data directly through the service (no API round
// trip). Changes go through /api/admin/brands from the client component.
export default async function BrandsPage() {
  // Checked in every page, not only the layout: layouts don't re-run on
  // client-side navigation, pages do.
  const auth = await requireAdminPage();
  const brands = await listBrands(auth.companyId);

  return (
    <>
      <PageHeader title="Brands" description="Agencies and brands you distribute. Hidden brands are not shown to retailers." />
      <BrandManager brands={brands} />
    </>
  );
}
