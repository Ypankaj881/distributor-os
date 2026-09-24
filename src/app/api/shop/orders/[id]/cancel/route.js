import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { shopCancelSchema } from "@/server/validators/order";
import { transitionOrder } from "@/server/services/orderWorkflow";
import { getShopOrder } from "@/server/services/orderService";
import { ORDER_STATUS } from "@/lib/constants";

// POST /api/shop/orders/:id/cancel — { reason? } ; only the shop's own NEW orders
export const POST = withApi(async (req, { params }) => {
  const auth = await requireRetailer();
  const { id } = await params;
  const { reason } = shopCancelSchema.parse(await readJson(req));
  await transitionOrder(
    auth.companyId,
    id,
    { status: ORDER_STATUS.CANCELLED, note: reason ? `Cancelled by shop: ${reason}` : "Cancelled by shop" },
    { userId: auth.userId, name: auth.name, role: auth.role },
    { customerId: auth.customerId },
  );
  return ok(await getShopOrder(auth.companyId, auth.customerId, id));
});
