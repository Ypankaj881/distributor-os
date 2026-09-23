import { formatINR } from "@/lib/money";
import { cn } from "@/components/ui/cn";

// The shop's own price. Shows "+ GST" or "incl. GST" depending on the
// distributor's setting, and MRP for reference when there is one.
export default function PriceTag({ product, size = "md", className }) {
  const big = size === "lg";
  return (
    <div className={className}>
      <p className={cn("font-semibold tabular-nums text-slate-900", big ? "text-2xl" : "text-base")}>
        {formatINR(product.price)}
        <span className={cn("ml-1 font-normal text-slate-500", big ? "text-sm" : "text-xs")}>
          {product.pricesIncludeGst ? "incl. GST" : "+ GST"} / {product.unit}
        </span>
      </p>
      <p className={cn("text-slate-500", big ? "text-sm" : "text-xs")}>
        {!product.pricesIncludeGst && product.gstRate > 0 && <span>{formatINR(product.priceInclGst)} with {product.gstRate}% GST</span>}
        {product.mrp > 0 && (
          <span>
            {!product.pricesIncludeGst && product.gstRate > 0 ? " · " : ""}MRP <span className="line-through">{formatINR(product.mrp)}</span>
          </span>
        )}
      </p>
    </div>
  );
}
