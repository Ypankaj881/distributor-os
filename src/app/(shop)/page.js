import Link from "next/link";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ShopSearchBar from "@/components/shop/ShopSearchBar";
import BrandTile from "@/components/shop/BrandTile";
import ProductCard from "@/components/shop/ProductCard";
import { requireRetailerPage } from "@/server/auth/guards";
import { listShopBrands, listShopProducts } from "@/server/services/catalogService";
import { recentOrdersForReorder } from "@/server/services/reorderService";
import ReorderButton from "@/components/shop/ReorderButton";
import InstallAppPrompt from "@/components/pwa/InstallAppPrompt";
import { StatusBadge } from "@/components/ui/Badge";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export const metadata = { title: "Home" };

const BRANDS_ON_HOME = 8;

export default async function ShopHomePage() {
  const auth = await requireRetailerPage();
  const [brands, { items: products, meta }, recentOrders] = await Promise.all([
    listShopBrands(auth.companyId),
    listShopProducts(auth.companyId, auth.customerId, { page: 1, limit: 8 }, auth.company.settings),
    recentOrdersForReorder(auth.companyId, auth.customerId),
  ]);
  const tz = auth.company.settings?.timezone ?? "Asia/Kolkata";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Hello, {auth.name.split(" ")[0]}</h1>
        <p className="mt-0.5 text-sm text-slate-500">What would you like to order today?</p>
      </div>

      <ShopSearchBar />

      <InstallAppPrompt appName={auth.company.name} />

      {recentOrders.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Buy again</h2>
            <Link href="/orders" className="text-sm font-medium text-brand-600">My orders</Link>
          </div>
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
            {recentOrders.map((o) => (
              <li key={o.id} className="w-[85%] shrink-0 snap-start sm:w-auto">
                <Card className="flex h-full flex-col gap-3 p-4">
                  <Link href={`/orders/${o.id}`} className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{o.orderNumber}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-xs text-slate-500">{formatDate(o.createdAt, tz)} · {o.itemCount} items · {formatINR(o.grandTotal)}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{o.preview.join(", ")}{o.itemCount > 3 ? "…" : ""}</p>
                  </Link>
                  <ReorderButton orderId={o.id} size="md" variant="secondary" className="mt-auto" />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

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
