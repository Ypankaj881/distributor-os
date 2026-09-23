import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ShopSearchBar from "@/components/shop/ShopSearchBar";
import BrandChips from "@/components/shop/BrandChips";
import ProductGrid from "@/components/shop/ProductGrid";
import { requireRetailerPage } from "@/server/auth/guards";
import { listShopBrands, listShopProducts } from "@/server/services/catalogService";
import { shopProductQuerySchema } from "@/server/validators/catalog";

export const metadata = { title: "Products" };

// Product listing AND search results (same screen, ?q= decides).
export default async function ShopProductsPage({ searchParams }) {
  const auth = await requireRetailerPage();
  const query = shopProductQuerySchema.parse({ ...(await searchParams), page: 1 });

  const [brands, { items, meta }] = await Promise.all([
    listShopBrands(auth.companyId),
    listShopProducts(auth.companyId, auth.customerId, query, auth.company.settings),
  ]);
  const activeBrand = brands.find((b) => b.id === query.brandId);

  const heading = query.q
    ? `${meta.total} result${meta.total === 1 ? "" : "s"} for “${query.q}”${activeBrand ? ` in ${activeBrand.name}` : ""}`
    : activeBrand
      ? `${activeBrand.name} · ${meta.total} product${meta.total === 1 ? "" : "s"}`
      : `All products · ${meta.total}`;

  return (
    <div className="space-y-4">
      <ShopSearchBar live defaultValue={query.q ?? ""} brandId={query.brandId ?? ""} />
      {brands.length > 1 && <BrandChips brands={brands} activeBrandId={query.brandId} q={query.q} />}

      <h1 className="text-sm font-medium text-slate-600">{heading}</h1>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon="search"
            title="No products found"
            description={query.q ? "Check the spelling, or try the brand name or product code." : "Nothing here yet."}
            action={(query.q || query.brandId) && <Button variant="secondary" href="/products">Show all products</Button>}
          />
        </Card>
      ) : (
        <ProductGrid key={`${query.q ?? ""}|${query.brandId ?? ""}`} initialItems={items} initialMeta={meta} query={{ q: query.q, brandId: query.brandId }} />
      )}
    </div>
  );
}
