import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ShareOrderButton from "@/components/shop/ShareOrderButton";
import { requireRetailerPage } from "@/server/auth/guards";
import { formatINR } from "@/lib/money";
import { loadShopOrderOr404 } from "../../loadOrder";

export const metadata = { title: "Order placed" };

export default async function OrderPlacedPage({ params }) {
  const auth = await requireRetailerPage();
  const { id } = await params;
  const order = await loadShopOrderOr404(auth, id);

  return (
    <div className="mx-auto max-w-md space-y-5 py-4 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Order placed</h1>
        <p className="mt-1 text-slate-600">
          Order <span className="font-semibold text-slate-900">{order.orderNumber}</span> has been sent to {auth.company.name}.
        </p>
      </div>

      <Card className="divide-y divide-slate-100 text-left text-sm">
        <div className="flex justify-between px-4 py-3"><span className="text-slate-500">Items</span><span className="font-medium">{order.items.length}</span></div>
        <div className="flex justify-between px-4 py-3"><span className="text-slate-500">Total</span><span className="font-semibold">{formatINR(order.grandTotal)}</span></div>
        <div className="flex justify-between px-4 py-3"><span className="text-slate-500">Status</span><span className="font-medium text-amber-700">Waiting for confirmation</span></div>
      </Card>

      <p className="text-sm text-slate-500">You&apos;ll see updates in My Orders as your order is confirmed, packed and dispatched.</p>

      <div className="grid gap-2">
        <ShareOrderButton order={order} distributorPhone={auth.company.phone} className="w-full" />
        <Button variant="secondary" size="lg" href={`/orders/${order.id}`}>View order</Button>
        <Button variant="ghost" size="lg" href="/products">Continue shopping</Button>
      </div>
    </div>
  );
}
