"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ProductImage from "@/components/ui/ProductImage";
import QtyStepper from "@/components/ui/QtyStepper";
import Spinner from "@/components/ui/Spinner";
import { useCart } from "./CartProvider";
import { api } from "@/lib/apiClient";
import { formatINR } from "@/lib/money";
import { unitLabel } from "@/lib/tax";
import { cn } from "@/components/ui/cn";

function CartLine({ line, quantity, onQuantity, onRemove }) {
  const blocked = line.issues.length > 0;
  return (
    <li className={cn("flex gap-3 p-4", !line.available && "bg-slate-50")}>
      <Link href={`/products/${line.productId}`} className="shrink-0">
        <ProductImage src={line.imageUrl} alt={line.name} className={cn("size-16 text-sm", !line.available && "opacity-50")} />
      </Link>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">{line.brandName}</p>
            <Link href={`/products/${line.productId}`} className="line-clamp-2 font-medium leading-snug">{line.name}</Link>
            {line.available && (
              <p className="text-xs text-slate-500">{formatINR(line.price)} / {unitLabel(line.unit, line.packSize)} · GST {line.gstRate}%</p>
            )}
          </div>
          {line.available && <p className="shrink-0 font-semibold tabular-nums">{formatINR(line.taxable)}</p>}
        </div>

        {blocked && (
          <ul className="space-y-0.5">
            {line.issues.map((i) => (
              <li key={i.code} className="text-sm font-medium text-red-600">{i.message}</li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2">
          {line.available ? (
            <QtyStepper value={quantity} min={line.minOrderQty} onChange={onQuantity} label={`Quantity of ${line.name}`} />
          ) : (
            <span />
          )}
          <button type="button" onClick={onRemove} className="rounded-lg px-2 py-2 text-sm font-medium text-slate-500 hover:text-red-600">
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

// initialView: the cart as priced by the server when the page loaded.
// Afterwards, every change returns a freshly priced cart from the server.
export default function CartView({ initialView }) {
  const { quantities, setQuantity, replaceCart, lastView, viewVersion, syncing } = useCart();
  const [mountVersion] = useState(viewVersion);
  const [clearing, setClearing] = useState(false);
  const view = viewVersion > mountVersion && lastView ? lastView : initialView;

  // Show lines the server knows about; hide ones the shop just removed locally.
  const lines = view.lines.filter((l) => !l.available || quantities[l.productId] > 0);

  async function clearAll() {
    if (!window.confirm("Remove all items from your cart?")) return;
    setClearing(true);
    const res = await api.delete("/api/shop/cart");
    setClearing(false);
    if (res.ok) replaceCart(res.data);
  }

  if (lines.length === 0) {
    return (
      <Card>
        <EmptyState icon="cart" title="Your cart is empty" description="Browse products and tap Add to start an order." action={<Button href="/products">Browse products</Button>} />
      </Card>
    );
  }

  const { totals } = view;
  const blocked = !view.canCheckout;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-medium">{lines.length} product{lines.length === 1 ? "" : "s"}</p>
          <button type="button" onClick={clearAll} disabled={clearing} className="text-sm text-slate-500 hover:text-red-600">
            {clearing ? "Clearing…" : "Clear cart"}
          </button>
        </div>
        <ul className="divide-y divide-slate-100">
          {lines.map((line) => (
            <CartLine
              key={line.productId}
              line={line}
              quantity={quantities[line.productId] ?? line.quantity}
              onQuantity={(q) => setQuantity(line.productId, q)}
              onRemove={() => setQuantity(line.productId, 0)}
            />
          ))}
        </ul>
      </Card>

      {/* Order summary: one compact sticky row on phones, a full card on desktop */}
      <div className="safe-bottom sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 lg:top-20 lg:bottom-auto">
        <Card className="space-y-3 p-3 shadow-lg lg:p-4 lg:shadow-none">
          <dl className="hidden space-y-1 text-sm lg:block">
            <div className="flex justify-between"><dt className="text-slate-500">Items ({totals.unitCount})</dt><dd className="tabular-nums">{formatINR(totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">GST{view.pricesIncludeGst ? " (included)" : ""}</dt><dd className="tabular-nums">{formatINR(totals.gst)}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="flex items-center gap-2 tabular-nums">{syncing && <Spinner className="text-slate-400" />}{formatINR(totals.total)}</dd>
            </div>
          </dl>
          {blocked && <p className="text-sm text-red-600">Fix the items marked in red to continue.</p>}
          <div className="flex items-center gap-3 lg:block">
            <div className="min-w-0 lg:hidden">
              <p className="text-xs text-slate-500">{totals.unitCount} items · GST {formatINR(totals.gst)}</p>
              <p className="flex items-center gap-1.5 text-lg font-semibold tabular-nums">{formatINR(totals.total)}{syncing && <Spinner className="text-slate-400" />}</p>
            </div>
            <Button href={blocked || syncing ? undefined : "/checkout"} disabled={blocked || syncing} size="lg" className="flex-1 lg:w-full">
              {syncing ? "Updating…" : "Checkout"}
            </Button>
          </div>
          <p className="hidden text-center text-xs text-slate-500 lg:block">Prices are checked again when you place the order.</p>
        </Card>
      </div>
    </div>
  );
}
