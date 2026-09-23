"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/apiClient";

// Shared cart state for the whole retailer area (header badge, product-card
// steppers, cart page).
//
// How a quantity change works:
//  1. The UI updates IMMEDIATELY (optimistic) so tapping + feels instant.
//  2. The request is sent 350 ms after the last tap on that product
//     (tapping + five times sends ONE request, for the final quantity).
//  3. The server's answer (a fully re-priced cart) becomes the truth. If the
//     server refuses (stock, minimum qty…), the quantity goes back to the
//     last confirmed value and a message is shown.
//
// Prices/totals are NEVER calculated here — they always come from the server.

const CartContext = createContext(null);
const DEBOUNCE_MS = 350;

const toMap = (items) => Object.fromEntries(items.map((i) => [i.productId, i.quantity]));
const viewToItems = (view) => view.lines.map((l) => ({ productId: l.productId, quantity: l.quantity }));

export function CartProvider({ initialItems, children }) {
  const [quantities, setQuantities] = useState(() => toMap(initialItems));
  const [lastView, setLastView] = useState(null);
  const [viewVersion, setViewVersion] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  const confirmed = useRef(toMap(initialItems)); // last quantities the server accepted
  const timers = useRef({});
  const latestSeq = useRef({});
  const pending = useRef(new Set());

  const acceptView = useCallback((view) => {
    const serverMap = toMap(viewToItems(view));
    confirmed.current = serverMap;
    // Keep local values for products the shop is still changing.
    setQuantities((prev) => {
      const next = { ...serverMap };
      for (const id of pending.current) {
        if (prev[id]) next[id] = prev[id];
        else delete next[id];
      }
      return next;
    });
    setLastView(view);
    setViewVersion((v) => v + 1);
  }, []);

  const setQuantity = useCallback(
    (productId, quantity) => {
      setQuantities((prev) => {
        const next = { ...prev };
        if (quantity > 0) next[productId] = quantity;
        else delete next[productId];
        return next;
      });

      clearTimeout(timers.current[productId]);
      const seq = (latestSeq.current[productId] ?? 0) + 1;
      latestSeq.current[productId] = seq;
      pending.current.add(productId);
      setSyncing(true);

      timers.current[productId] = setTimeout(async () => {
        const res = await api.put(`/api/shop/cart/items/${productId}`, { quantity });
        if (latestSeq.current[productId] !== seq) {
          // A newer change is on its way; don't touch the screen, but remember
          // what the server accepted in case that newer change fails.
          if (res.ok) confirmed.current = toMap(viewToItems(res.data));
          return;
        }
        pending.current.delete(productId);
        setSyncing(pending.current.size > 0);

        if (!res.ok) {
          const back = confirmed.current[productId] ?? 0;
          setQuantities((prev) => {
            const next = { ...prev };
            if (back > 0) next[productId] = back;
            else delete next[productId];
            return next;
          });
          setToast({ id: Date.now(), text: res.error.message });
          return;
        }
        acceptView(res.data);
      }, DEBOUNCE_MS);
    },
    [acceptView],
  );

  // For actions that return a whole cart (clear, reorder, after placing an order).
  const replaceCart = useCallback(
    (view) => {
      for (const t of Object.values(timers.current)) clearTimeout(t);
      pending.current.clear();
      setSyncing(false);
      acceptView(view);
    },
    [acceptView],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const value = useMemo(
    () => ({
      quantities,
      count: Object.keys(quantities).length,
      setQuantity,
      replaceCart,
      lastView,
      viewVersion,
      syncing,
      showMessage: (text) => setToast({ id: Date.now(), text }),
    }),
    [quantities, setQuantity, replaceCart, lastView, viewVersion, syncing],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {toast && (
        <div role="alert" className="fixed inset-x-0 top-16 z-50 flex justify-center px-4">
          <div key={toast.id} className="max-w-md rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">{toast.text}</div>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>.");
  return ctx;
}
