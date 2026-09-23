// Shown instantly while the product list loads (Next.js streams the page in
// when ready). A skeleton feels faster than a blank screen on slow mobile data.
export default function ProductsLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading products">
      <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-slate-200" />)}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <li key={i} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-col">
            <div className="size-20 shrink-0 animate-pulse rounded-lg bg-slate-200 sm:aspect-square sm:h-auto sm:w-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
