"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import { formatINR } from "@/lib/money";

const POLL_MS = 30_000;

// A short, soft two-tone "ding" (no audio file needed). Browsers only allow
// sound after the user has interacted with the page, so it may stay silent
// until the first click — that's fine.
function ding() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.32);
    });
  } catch {
    // no audio support
  }
}

// Checks for new orders every 30 s while the admin tab is visible.
//  - keeps the NEW count up to date (sidebar badge + browser tab title)
//  - on a NEW order: a small pop-up + ding, and the dashboard / orders list refresh themselves
export function useNewOrders(initialCount) {
  const router = useRouter();
  const pathname = usePathname();
  const [count, setCount] = useState(initialCount);
  const [alert, setAlert] = useState(null);
  const lastSeen = useRef(null); // id of the newest NEW order we already know about
  const baseTitle = useRef(null);

  useEffect(() => {
    let stopped = false;
    async function check() {
      if (document.visibilityState !== "visible") return;
      const res = await api.get("/api/admin/orders/summary");
      if (stopped || !res.ok) return;
      const { newCount, latest } = res.data;
      setCount(newCount);
      if (latest && lastSeen.current && latest.id !== lastSeen.current) {
        setAlert(latest);
        ding();
        if (pathname === "/admin" || pathname === "/admin/orders") router.refresh();
      }
      if (latest) lastSeen.current = latest.id;
      else lastSeen.current = "none";
    }
    check();
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, router]);

  // "(3) Orders · Admin" in the browser tab while orders are waiting.
  useEffect(() => {
    const strip = (t) => t.replace(/^\(\d+\)\s/, "");
    baseTitle.current = strip(document.title);
    document.title = count > 0 ? `(${count}) ${baseTitle.current}` : baseTitle.current;
  }, [count, pathname]);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 12_000);
    return () => clearTimeout(t);
  }, [alert]);

  return { count, alert, dismiss: () => setAlert(null) };
}

export function NewOrderToast({ alert, onClose }) {
  if (!alert) return null;
  return (
    <div role="status" className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-amber-200 bg-white p-4 shadow-xl">
      <p className="text-sm font-semibold text-amber-800">New order received</p>
      <p className="mt-1 text-sm">
        <span className="font-medium">{alert.orderNumber}</span> from {alert.shopName} · {formatINR(alert.grandTotal)}
      </p>
      <div className="mt-3 flex gap-2">
        <Link href={`/admin/orders/${alert.id}`} onClick={onClose} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          Open order
        </Link>
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Dismiss</button>
      </div>
    </div>
  );
}
