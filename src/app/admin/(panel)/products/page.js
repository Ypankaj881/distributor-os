import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import ProductImage from "@/components/ui/ProductImage";
import Icon from "@/components/ui/Icon";
import ListFilters from "@/components/admin/ListFilters";
import StockBadge from "@/components/admin/StockBadge";
import { requireAdminPage } from "@/server/auth/guards";
import { listProducts } from "@/server/services/productService";
import { listBrandOptions } from "@/server/services/brandService";
import { productListQuerySchema } from "@/server/validators/product";
import { formatINR } from "@/lib/money";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }) {
  const auth = await requireAdminPage();
  // .catch() rules in the schema turn junk URL values into defaults instead of errors.
  const query = productListQuerySchema.parse(await searchParams);
  const threshold = auth.company.settings?.lowStockThreshold ?? 10;

  const [{ items, meta }, brands] = await Promise.all([
    listProducts(auth.companyId, query, auth.company.settings),
    listBrandOptions(auth.companyId),
  ]);

  const hasFilters = Boolean(query.q || query.brandId || query.status !== "all" || query.stock);

  return (
    <>
      <PageHeader
        title="Products"
        description={`${meta.total} product${meta.total === 1 ? "" : "s"}${hasFilters ? " match your filters" : ""}`}
        actions={brands.length > 0 && <Button href="/admin/products/new"><Icon name="plus" className="size-4" />Add product</Button>}
      />

      <div className="mb-4">
        <ListFilters
          basePath="/admin/products"
          search={{ value: query.q ?? "", placeholder: "Search name, SKU or brand" }}
          selects={[
            { name: "brandId", label: "Brand", value: query.brandId ?? "", options: [{ value: "", label: "All brands" }, ...brands.map((b) => ({ value: b.id, label: b.name }))] },
            { name: "status", label: "Status", value: query.status, defaultValue: "all", options: [{ value: "all", label: "All status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
            { name: "stock", label: "Stock", value: query.stock ?? "", options: [{ value: "", label: "All stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }] },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          brands.length === 0 ? (
            <EmptyState icon="layers" title="Add a brand first" description="Every product belongs to a brand." action={<Button href="/admin/brands">Go to brands</Button>} />
          ) : hasFilters ? (
            <EmptyState icon="search" title="No products found" description="Try a different search or clear the filters." action={<Button variant="secondary" href="/admin/products">Clear filters</Button>} />
          ) : (
            <EmptyState icon="box" title="No products yet" description="Add your first product to start taking orders." action={<Button href="/admin/products/new">Add product</Button>} />
          )
        ) : (
          <>
            {/* Desktop / tablet: table */}
            <table className="hidden w-full text-sm md:table">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">MRP</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                        <ProductImage src={p.imageUrl} alt={p.name} className="size-10 shrink-0 text-xs" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900 hover:text-brand-600">{p.name}</span>
                          <span className="block font-mono text-xs text-slate-500">{p.sku}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.brand.name}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatINR(p.defaultPrice)}
                      <span className="block text-xs font-normal text-slate-500">per {p.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{p.mrp ? formatINR(p.mrp) : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{p.gstRate}%</td>
                    <td className="px-4 py-3"><StockBadge quantity={p.stockQuantity} threshold={threshold} unit={p.unit} /></td>
                    <td className="px-4 py-3">{p.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phone: cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {items.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex gap-3 p-4 active:bg-slate-50">
                    <ProductImage src={p.imageUrl} alt={p.name} className="size-14 shrink-0 text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.brand.name} · <span className="font-mono">{p.sku}</span></p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{formatINR(p.defaultPrice)}<span className="font-normal text-slate-500">/{p.unit}</span></span>
                        <StockBadge quantity={p.stockQuantity} threshold={threshold} unit={p.unit} />
                        {!p.isActive && <Badge>Inactive</Badge>}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {items.length > 0 && (
        <div className="mt-4">
          <Pagination basePath="/admin/products" params={{ q: query.q, brandId: query.brandId, status: query.status === "all" ? "" : query.status, stock: query.stock }} page={meta.page} totalPages={meta.totalPages} total={meta.total} />
        </div>
      )}
    </>
  );
}
