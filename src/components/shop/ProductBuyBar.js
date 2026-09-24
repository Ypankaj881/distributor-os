"use client";

import Button from "@/components/ui/Button";
import AddToCartControl from "./AddToCartControl";
import { useCart } from "./CartProvider";

// Product page: Add / quantity control that sticks above the bottom nav on
// phones, so it's always one thumb-tap away while reading the details.
export default function ProductBuyBar({ product }) {
  const { quantities } = useCart();
  const inCart = (quantities[product.id] ?? 0) > 0;

  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
      <div className="flex gap-2">
        <AddToCartControl product={product} size="lg" className="flex-1 [&>input]:flex-1" />
        {inCart && <Button variant="secondary" size="lg" href="/cart">Cart</Button>}
      </div>
      {product.minOrderQty > 1 && <p className="mt-1 text-xs text-slate-500">Minimum {product.minOrderQty} {product.unit} per order.</p>}
    </div>
  );
}
