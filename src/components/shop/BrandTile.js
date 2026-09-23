import Link from "next/link";
import ProductImage from "@/components/ui/ProductImage";

export default function BrandTile({ brand }) {
  return (
    <Link
      href={`/products?brandId=${brand.id}`}
      className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center active:bg-slate-50 hover:border-brand-200"
    >
      <ProductImage src={brand.logoUrl} alt={brand.name} className="size-14 rounded-full text-base" />
      <span className="line-clamp-2 text-sm font-medium leading-tight text-slate-900">{brand.name}</span>
      <span className="text-xs text-slate-500">{brand.productCount} item{brand.productCount === 1 ? "" : "s"}</span>
    </Link>
  );
}
