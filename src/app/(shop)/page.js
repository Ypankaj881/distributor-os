import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { getAuth } from "@/server/auth/current";

export const metadata = { title: "Home" };

// Placeholder home — becomes search + brands + "Buy again" in Phase 5/11.
export default async function ShopHomePage() {
  const auth = await getAuth(); // cached: the layout already loaded it

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Hello, {auth.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-slate-500">Order from {auth.company.name} in a few taps.</p>
      </div>

      <div className="flex h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-slate-400">
        <Icon name="search" />
        <span className="text-base">Search products, brands or SKU</span>
      </div>

      <Card className="p-5">
        <p className="text-sm font-medium text-slate-900">You&apos;re logged in</p>
        <p className="mt-1 text-sm text-slate-500">Product browsing, cart and orders arrive in the next phases.</p>
      </Card>
    </div>
  );
}
