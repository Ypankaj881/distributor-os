import { cn } from "./cn";

export default function Card({ className, children, ...props }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white", className)} {...props}>
      {children}
    </div>
  );
}
