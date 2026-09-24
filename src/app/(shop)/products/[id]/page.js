import { notFound } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import ProductImage from "@/components/ui/ProductImage";
import PriceTag from "@/components/shop/PriceTag";
import AvailabilityBadge from "@/components/shop/AvailabilityBadge";
import ProductBuyBar from "@/components/shop/ProductBuyBar";
import { requireRetailerPage } from "@/server/auth/guards";
import { getShopProduct } from "@/server/services/catalogService";
import { AppError } from "@/server/http/errors";
import { unitLabel } from "@/lib/tax";

export const metadata = { title: "Product" };

export default async function ShopProductPage({ params }) {
  const auth = await requireRetailerPage();
  const { id } = await params;

  let product;
  try {
    product = await getShopProduct(auth.companyId, auth.customerId, id, auth.company.settings);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }

  const savePct = product.mrp > 0 && product.priceInclGst < product.mrp ? Math.round(((product.mrp - product.priceInclGst) / product.mrp) * 100) : 0;

  return (
    <div className="space-y-4">
      <Link href="/products" className="inline-block text-sm text-slate-500">← Products</Link>

      <div className="grid gap-5 md:grid-cols-[minmax(0,360px)_1fr]">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className={product.imageUrl ? "mx-auto aspect-square w-full max-w-xs md:max-w-none" : "h-28 w-full text-3xl md:aspect-square md:h-auto"}
        />

        <div className="space-y-4">
          <div>
            <Link href={`/products?brandId=${product.brand.id}`} className="text-sm font-medium uppercase tracking-wide text-brand-600">
              {product.brand.name}
            </Link>
            <h1 className="mt-1 text-xl font-semibold leading-snug">{product.name}</h1>
            <p className="mt-1 font-mono text-xs text-slate-500">{product.sku}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <PriceTag product={product} size="lg" />
            <AvailabilityBadge availability={product.availability} />
          </div>
          {savePct > 0 && <p className="text-sm font-medium text-emerald-700">{savePct}% below MRP</p>}

          <Card className="divide-y divide-slate-100 text-sm">
            <Row label="Sold as" value={unitLabel(product.unit, product.packSize)} />
            <Row label="Minimum order" value={`${product.minOrderQty} ${product.unit}`} />
            <Row label="GST" value={`${product.gstRate}%${product.pricesIncludeGst ? " (included in price)" : " (added at checkout)"}`} />
          </Card>

          <ProductBuyBar product={product} />

          {product.description && (
            <div>
              <h2 className="mb-1 text-sm font-semibold">About this product</h2>
              <p className="whitespace-pre-line text-sm text-slate-600">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
