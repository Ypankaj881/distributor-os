import { cn } from "./cn";

const TONES = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-brand-200 bg-brand-50 text-brand-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

export default function Alert({ tone = "error", className, children }) {
  if (!children) return null;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2.5 text-sm", TONES[tone], className)}>
      {children}
    </div>
  );
}
