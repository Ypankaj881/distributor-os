import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { cartQuantitySchema } from "@/server/validators/cart";
import { setCartItem, removeCartItem } from "@/server/services/cartService";

// PUT /api/shop/cart/items/:productId — { quantity } SETS the quantity (0 removes).
// "Set" rather than "add" so a retried request can't double the quantity.
// Only product + quantity are accepted; price is never taken from the client.
export const PUT = withApi(async (req, { params }) => {
  const auth = await requireRetailer();
  const { productId } = await params;
  const { quantity } = cartQuantitySchema.parse(await readJson(req));
  return ok(await setCartItem(auth.companyId, auth.customerId, productId, quantity, auth.company.settings));
});

// DELETE /api/shop/cart/items/:productId
export const DELETE = withApi(async (_req, { params }) => {
  const auth = await requireRetailer();
  const { productId } = await params;
  return ok(await removeCartItem(auth.companyId, auth.customerId, productId, auth.company.settings));
});
