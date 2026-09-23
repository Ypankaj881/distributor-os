import { useId } from "react";
import { cn } from "./cn";

export default function Textarea({ label, error, hint, id, className, rows = 3, ...props }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(
          "block w-full rounded-lg border bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400",
          "focus:outline-none focus:ring-2 focus:ring-brand-500/30",
          error ? "border-red-400" : "border-slate-300 focus:border-brand-500",
        )}
        {...props}
      />
      {error ? <p className="mt-1.5 text-sm text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}
