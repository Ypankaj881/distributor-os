export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />)}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
    </div>
  );
}
