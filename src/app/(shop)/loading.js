// Generic skeleton for any retailer page while it loads on a slow connection.
// (The products list has its own, more specific skeleton.)
export default function ShopLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
      <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
      <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
    </div>
  );
}
