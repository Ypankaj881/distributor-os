"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { cn } from "@/components/ui/cn";
import { useCart } from "./CartProvider";
import { CountBadge } from "./CartIconLink";

export const SHOP_NAV = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/products", label: "Products", icon: "grid" },
  { href: "/cart", label: "Cart", icon: "cart" },
  { href: "/orders", label: "Orders", icon: "orders" },
  { href: "/account", label: "Account", icon: "user" },
];

function isActive(pathname, href) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Fixed bottom tab bar — thumb-reachable navigation on phones.
export function BottomNav() {
  const pathname = usePathname();
  const { count } = useCart();
  return (
    <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {SHOP_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-brand-600" : "text-slate-500",
                )}
              >
                <span className="relative">
                  <Icon name={item.icon} className="size-6" />
                  {item.href === "/cart" && <CountBadge count={count} className="absolute -right-3 -top-1.5" />}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Inline links shown in the header on tablets/desktop instead of the bottom bar.
export function TopNavLinks() {
  const pathname = usePathname();
  const { count } = useCart();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {SHOP_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {item.label}
                {item.href === "/cart" && count > 0 && <span className="ml-1 text-brand-600">({count})</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
