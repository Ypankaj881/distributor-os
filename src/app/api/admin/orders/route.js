import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { paramsToObject } from "@/server/validators/common";
import { adminOrderListQuerySchema } from "@/server/validators/order";
import { listAdminOrders, countOrdersByStatus } from "@/server/services/adminOrderService";

// GET /api/admin/orders?status=all|open|closed|NEW|…&q=&customerId=&from=YYYY-MM-DD&to=&page=
export const GET = withApi(async (req) => {
  const auth = await requireAdmin();
  const query = adminOrderListQuerySchema.parse(paramsToObject(req.nextUrl.searchParams));
  const [{ items, meta }, counts] = await Promise.all([
    listAdminOrders(auth.companyId, query, { timeZone: auth.company.settings?.timezone }),
    countOrdersByStatus(auth.companyId),
  ]);
  return ok(items, { meta: { ...meta, counts } });
});
