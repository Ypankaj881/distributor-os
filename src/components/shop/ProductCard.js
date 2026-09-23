import Link from "next/link";
import ProductImage from "@/components/ui/ProductImage";
import PriceTag from "./PriceTag";
import AvailabilityBadge from "./AvailabilityBadge";
import { unitLabel } from "@/lib/tax";

// Phone: a compact row (image left, details right) — long product names stay
// readable. Tablet/desktop: the same content as a grid card.
export default function ProductCard({ product }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors active:bg-slate-50 sm:flex-col sm:hover:border-brand-200"
    >
      <ProductImage src={product.imageUrl} alt={product.name} className="size-20 shrink-0 text-lg sm:aspect-square sm:h-auto sm:w-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{product.brand.name}</p>
        <p className="line-clamp-2 font-medium leading-snug text-slate-900">{product.name}</p>
        <p className="text-xs text-slate-500">
          {unitLabel(product.unit, product.packSize)}
          {product.minOrderQty > 1 && ` · Min ${product.minOrderQty}`}
        </p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-1">
          <PriceTag product={product} />
          <AvailabilityBadge availability={product.availability} />
        </div>
      </div>
    </Link>
  );
}
