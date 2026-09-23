"use client";

import { useState } from "react";
import Icon from "./Icon";
import { cn } from "./cn";

// [ − ] [ 12 ] [ + ] with big touch targets. The number can also be typed.
// Going below `min` with − means "remove" (onChange(0)).
export default function QtyStepper({ value, onChange, min = 1, max, size = "md", label = "Quantity", className }) {
  const [text, setText] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);
  // Keep the text box in sync when the value changes from outside
  // (React's recommended "adjust state when a prop changes" pattern).
  if (value !== prevValue) {
    setPrevValue(value);
    setText(String(value));
  }

  const commit = () => {
    const n = parseInt(text, 10);
    if (!Number.isFinite(n) || n <= 0) {
      onChange(0);
      return;
    }
    let next = Math.max(n, min);
    if (max != null) next = Math.min(next, max);
    setText(String(next));
    if (next !== value) onChange(next);
  };

  const h = size === "lg" ? "h-12" : "h-10";
  const btn = cn(
    "flex shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-800 active:bg-slate-200 disabled:opacity-40",
    size === "lg" ? "size-12" : "size-10",
  );

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button type="button" className={btn} aria-label={value <= min ? "Remove" : "Decrease quantity"} onClick={() => onChange(value <= min ? 0 : value - 1)}>
        <Icon name={value <= min ? "x" : "minus"} className="size-5" strokeWidth={2.2} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(h, "w-14 min-w-0 rounded-lg border border-slate-300 bg-white text-center font-semibold tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30")}
      />
      <button type="button" className={btn} aria-label="Increase quantity" disabled={max != null && value >= max} onClick={() => onChange(value + 1)}>
        <Icon name="plus" className="size-5" strokeWidth={2.2} />
      </button>
    </div>
  );
}
