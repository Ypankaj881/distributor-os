import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

export const metadata = { title: "Home" };

// Placeholder home — becomes search + brands + "Buy again" in Phase 5/11.
export default function ShopHomePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Welcome</h1>
        <p className="mt-1 text-sm text-slate-500">Order from your distributor in a few taps.</p>
      </div>

      <div className="flex h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-slate-400">
        <Icon name="search" />
        <span className="text-base">Search products, brands or SKU</span>
      </div>

      <Card className="p-5">
        <p className="text-sm font-medium text-slate-900">Setup complete</p>
        <p className="mt-1 text-sm text-slate-500">
          Phase 1 scaffold. Product browsing, cart and orders arrive in later phases.
        </p>
        <Button size="lg" className="mt-4 w-full sm:w-auto" href="/admin">
          Open admin panel
        </Button>
      </Card>
    </div>
  );
}
