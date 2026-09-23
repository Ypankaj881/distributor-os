"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { useCart } from "./CartProvider";

export function CountBadge({ count, className = "" }) {
  if (!count) return null;
  return (
    <span className={`flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold leading-5 text-white ${className}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function CartIconLink() {
  const { count } = useCart();
  return (
    <Link href="/cart" aria-label={`Cart, ${count} items`} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
      <Icon name="cart" className="size-6" />
      <CountBadge count={count} className="absolute right-0 top-0" />
    </Link>
  );
}
