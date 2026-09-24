import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { reorderToCart } from "@/server/services/reorderService";

// POST /api/shop/orders/:id/reorder — adds the order's products to the cart at
// TODAY's prices and availability. Returns { added, skipped, view (priced cart) }.
export const POST = withApi(async (_req, { params }) => {
  const auth = await requireRetailer();
  const { id } = await params;
  return ok(await reorderToCart(auth, id));
});
