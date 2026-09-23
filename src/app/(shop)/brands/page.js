import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import BrandTile from "@/components/shop/BrandTile";
import { requireRetailerPage } from "@/server/auth/guards";
import { listShopBrands } from "@/server/services/catalogService";

export const metadata = { title: "Brands" };

export default async function ShopBrandsPage() {
  const auth = await requireRetailerPage();
  const brands = await listShopBrands(auth.companyId);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Brands</h1>
      {brands.length === 0 ? (
        <Card><EmptyState icon="layers" title="No brands yet" description="Please check back soon." /></Card>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {brands.map((b) => (
            <li key={b.id}><BrandTile brand={b} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
