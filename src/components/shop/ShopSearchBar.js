"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Spinner from "@/components/ui/Spinner";

// Big, thumb-friendly search box.
//  live=false (home page): searching opens /products?q=…
//  live=true  (products page): results update as you type (debounced 400 ms)
export default function ShopSearchBar({ defaultValue = "", brandId = "", live = false, autoFocus = false }) {
  const router = useRouter();
  const [text, setText] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();
  const last = useRef(defaultValue);

  function go(value, { replace } = {}) {
    const sp = new URLSearchParams();
    if (value.trim()) sp.set("q", value.trim());
    if (brandId) sp.set("brandId", brandId);
    const url = sp.toString() ? `/products?${sp}` : "/products";
    last.current = value;
    startTransition(() => (replace ? router.replace(url, { scroll: false }) : router.push(url)));
  }

  useEffect(() => {
    if (!live || text.trim() === last.current.trim()) return;
    const timer = setTimeout(() => go(text, { replace: true }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, live]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(text, { replace: live });
        e.currentTarget.querySelector("input")?.blur(); // hide the phone keyboard
      }}
      className="relative"
    >
      <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search products, brands or SKU"
        aria-label="Search products"
        className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-12 text-base shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
        {isPending ? (
          <Spinner className="m-2 text-slate-400" />
        ) : (
          text && (
            <button type="button" aria-label="Clear search" onClick={() => { setText(""); if (live) go("", { replace: true }); }} className="rounded-lg p-2 text-slate-400 hover:text-slate-600">
              <Icon name="x" className="size-5" />
            </button>
          )
        )}
      </div>
    </form>
  );
}
