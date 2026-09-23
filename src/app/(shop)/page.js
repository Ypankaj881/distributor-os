import Link from "next/link";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ShopSearchBar from "@/components/shop/ShopSearchBar";
import BrandTile from "@/components/shop/BrandTile";
import ProductCard from "@/components/shop/ProductCard";
import { requireRetailerPage } from "@/server/auth/guards";
import { listShopBrands, listShopProducts } from "@/server/services/catalogService";

export const metadata = { title: "Home" };

const BRANDS_ON_HOME = 8;

export default async function ShopHomePage() {
  const auth = await requireRetailerPage();
  const [brands, { items: products, meta }] = await Promise.all([
    listShopBrands(auth.companyId),
    listShopProducts(auth.companyId, auth.customerId, { page: 1, limit: 8 }, auth.company.settings),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Hello, {auth.name.split(" ")[0]}</h1>
        <p className="mt-0.5 text-sm text-slate-500">What would you like to order today?</p>
      </div>

      <ShopSearchBar />

      {/* "Buy again" from past orders is added with the reorder feature. */}

      {brands.length === 0 ? (
        <Card>
          <EmptyState icon="box" title="No products yet" description={`${auth.company.name} hasn't added products yet. Please check back soon.`} />
        </Card>
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-semibold">Brands</h2>
              {brands.length > BRANDS_ON_HOME && <Link href="/brands" className="text-sm font-medium text-brand-600">See all</Link>}
            </div>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {brands.slice(0, BRANDS_ON_HOME).map((b) => (
                <li key={b.id}><BrandTile brand={b} /></li>
              ))}
            </ul>
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-semibold">Products</h2>
              <Link href="/products" className="text-sm font-medium text-brand-600">See all {meta.total}</Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((p) => (
                <li key={p.id}><ProductCard product={p} /></li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
