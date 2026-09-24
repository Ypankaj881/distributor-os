"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

const DISMISS_KEY = "installPromptDismissedAt";
const SNOOZE_DAYS = 14;

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < SNOOZE_DAYS * 86400000;
  } catch {
    return false;
  }
}

// "Install the app" card for shopkeepers.
//  - Android/Chrome: uses the browser's install prompt (one tap).
//  - iPhone/Safari: shows how to "Add to Home Screen" (no prompt API there).
//  - Hidden when already installed, or for 14 days after "Not now".
export default function InstallAppPrompt({ appName }) {
  const [deferred, setDeferred] = useState(null);
  const [mode, setMode] = useState(null); // "android" | "ios" | null

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (standalone || recentlyDismissed()) return;

    const onPrompt = (e) => {
      e.preventDefault(); // we show our own card instead of the mini-infobar
      setDeferred(e);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
    const timer = isIos ? setTimeout(() => setMode("ios"), 0) : null;

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // private mode: just hide for now
    }
    setMode(null);
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    setMode(null);
  }

  if (!mode) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
      <div className="rounded-lg bg-brand-600 p-2 text-white"><Icon name="home" className="size-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">Add {appName} to your home screen</p>
        {mode === "android" ? (
          <p className="text-sm text-slate-600">Open it like an app — one tap, no Play Store needed.</p>
        ) : (
          <p className="text-sm text-slate-600">
            Tap the <span className="font-medium">Share</span> button in Safari, then <span className="font-medium">Add to Home Screen</span>.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {mode === "android" && <Button size="sm" onClick={install}>Install app</Button>}
          <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
        </div>
      </div>
    </div>
  );
}
