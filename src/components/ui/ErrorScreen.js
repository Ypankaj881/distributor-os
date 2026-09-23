"use client";

import { useEffect } from "react";
import Button from "./Button";
import Icon from "./Icon";

// Shared body for error.js boundaries. Shown when a page fails to load
// (database down, network hiccup). `retry` re-fetches the page.
export default function ErrorScreen({ error, retry, homeHref = "/" }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 rounded-full bg-red-50 p-3 text-red-600">
        <Icon name="x" className="size-6" />
      </div>
      <h2 className="text-base font-semibold text-slate-900">{offline ? "You're offline" : "Something went wrong"}</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {offline ? "Check your internet connection and try again." : "We couldn't load this page. Please try again in a moment."}
      </p>
      <div className="mt-5 flex gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="secondary" href={homeHref}>Go home</Button>
      </div>
      {error?.digest && <p className="mt-4 font-mono text-xs text-slate-400">Ref: {error.digest}</p>}
    </div>
  );
}
