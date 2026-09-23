import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { getShopOrder } from "@/server/services/orderService";

// GET /api/shop/orders/:id — only the shop's own orders (others → 404)
export const GET = withApi(async (_req, { params }) => {
  const auth = await requireRetailer();
  const { id } = await params;
  return ok(await getShopOrder(auth.companyId, auth.customerId, id));
});
