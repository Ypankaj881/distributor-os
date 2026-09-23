import { redirect } from "next/navigation";
import Link from "next/link";
import CheckoutForm from "@/components/shop/CheckoutForm";
import { requireRetailerPage } from "@/server/auth/guards";
import { getCartView } from "@/server/services/cartService";
import { getShopAddresses } from "@/server/services/customerService";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const auth = await requireRetailerPage();
  const [view, addresses] = await Promise.all([
    getCartView(auth.companyId, auth.customerId, auth.company.settings),
    getShopAddresses(auth.companyId, auth.customerId),
  ]);

  // Nothing to order, or something needs fixing → back to the cart.
  if (view.lines.length === 0 || !view.canCheckout) redirect("/cart");

  return (
    <div className="space-y-4">
      <Link href="/cart" className="inline-block text-sm text-slate-500">← Back to cart</Link>
      <h1 className="text-xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutForm view={view} addresses={addresses} />
    </div>
  );
}
