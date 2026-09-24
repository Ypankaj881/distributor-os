"use client";

import { useEffect } from "react";

// Registers /sw.js in production builds (makes the app installable).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // not fatal: the site works the same without it
    });
  }, []);
  return null;
}
