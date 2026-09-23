import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { BottomNav, TopNavLinks } from "@/components/shop/ShopNav";
import { requireRetailerPage } from "@/server/auth/guards";

// Retailer area layout (mobile-first).
// "(shop)" is a route group: the folder name is NOT part of the URL, so
// src/app/(shop)/orders/page.js is served at /orders.
export default async function ShopLayout({ children }) {
  const auth = await requireRetailerPage();

  return (
    <div className="pb-safe-nav md:pb-8">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="truncate text-base font-semibold text-slate-900">
            {auth.company.name}
          </Link>
          <TopNavLinks />
          <div className="flex items-center gap-1 md:hidden">
            <Link href="/products" aria-label="Search products" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
              <Icon name="search" className="size-6" />
            </Link>
            <Link href="/cart" aria-label="Cart" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
              <Icon name="cart" className="size-6" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>

      <BottomNav />
    </div>
  );
}
