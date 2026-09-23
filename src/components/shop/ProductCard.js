import Link from "next/link";
import ProductImage from "@/components/ui/ProductImage";
import PriceTag from "./PriceTag";
import AvailabilityBadge from "./AvailabilityBadge";
import AddToCartControl from "./AddToCartControl";
import { unitLabel } from "@/lib/tax";

// Phone: a compact row (image left, details right) — long product names stay
// readable. Tablet/desktop: the same content as a grid card.
// Only the image and text are links, so the Add / stepper buttons don't open
// the product page when tapped.
export default function ProductCard({ product }) {
  const href = `/products/${product.id}`;
  return (
    <div className="flex h-full gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-col">
      <Link href={href} className="shrink-0" tabIndex={-1} aria-hidden="true">
        <ProductImage src={product.imageUrl} alt={product.name} className="size-20 text-lg sm:aspect-square sm:h-auto sm:w-full" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={href} className="block">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{product.brand.name}</p>
          <p className="line-clamp-2 font-medium leading-snug text-slate-900">{product.name}</p>
          <p className="text-xs text-slate-500">
            {unitLabel(product.unit, product.packSize)}
            {product.minOrderQty > 1 && ` · Min ${product.minOrderQty}`}
          </p>
        </Link>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-1">
          <PriceTag product={product} />
          <AvailabilityBadge availability={product.availability} />
        </div>
        <AddToCartControl product={product} className="mt-2 w-full sm:w-full [&>input]:flex-1" />
      </div>
    </div>
  );
}
