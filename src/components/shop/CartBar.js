"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { useCart } from "./CartProvider";

// Sticky "N items · View cart" bar just above the bottom nav on phones.
// Hidden on the cart and checkout pages, and on product pages (sticky Add bar there).
export default function CartBar() {
  const { count } = useCart();
  const pathname = usePathname();
  const isProductPage = /^\/products\/[^/]+$/.test(pathname); // has its own sticky "Add" bar
  if (count === 0 || isProductPage || pathname.startsWith("/cart") || pathname.startsWith("/checkout")) return null;

  return (
    <>
      <div className="h-16 md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 z-30 px-3 md:hidden" style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}>
        <Link
          href="/cart"
          className="mx-auto flex h-14 max-w-lg items-center justify-between rounded-xl bg-brand-600 px-4 text-white shadow-lg active:bg-brand-700"
        >
          <span className="flex items-center gap-2 font-medium">
            <Icon name="cart" className="size-5" />
            {count} item{count === 1 ? "" : "s"} in cart
          </span>
          <span className="flex items-center gap-1 font-semibold">
            View cart <Icon name="chevronRight" className="size-5" />
          </span>
        </Link>
      </div>
    </>
  );
}
