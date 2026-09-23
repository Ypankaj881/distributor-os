import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { getCartView, clearCart } from "@/server/services/cartService";

// GET /api/shop/cart — lines with live prices, issues and totals (all computed on the server)
export const GET = withApi(async () => {
  const auth = await requireRetailer();
  return ok(await getCartView(auth.companyId, auth.customerId, auth.company.settings));
});

// DELETE /api/shop/cart — empty the cart
export const DELETE = withApi(async () => {
  const auth = await requireRetailer();
  await clearCart(auth.companyId, auth.customerId);
  return ok(await getCartView(auth.companyId, auth.customerId, auth.company.settings));
});
