import { useId } from "react";
import { cn } from "./cn";

export default function Select({ label, error, hint, id, className, selectClassName, children, ...props }) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "block h-11 w-full rounded-lg border bg-white px-3 text-slate-900",
          "focus:outline-none focus:ring-2 focus:ring-brand-500/30",
          error ? "border-red-400" : "border-slate-300 focus:border-brand-500",
          selectClassName,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="mt-1.5 text-sm text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}
