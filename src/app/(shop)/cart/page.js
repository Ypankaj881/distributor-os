import CartView from "@/components/shop/CartView";
import { requireRetailerPage } from "@/server/auth/guards";
import { getCartView } from "@/server/services/cartService";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const auth = await requireRetailerPage();
  const view = await getCartView(auth.companyId, auth.customerId, auth.company.settings);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Cart</h1>
      <CartView initialView={view} />
    </div>
  );
}
