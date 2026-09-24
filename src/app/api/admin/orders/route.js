import { withApi, readJson } from "@/server/http/apiHandler";
import { ok, created } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { paramsToObject } from "@/server/validators/common";
import { adminOrderListQuerySchema, adminOrderCreateSchema } from "@/server/validators/order";
import { listAdminOrders, countOrdersByStatus } from "@/server/services/adminOrderService";
import { createOrderForShop } from "@/server/services/orderService";

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

// POST /api/admin/orders — the distributor places an order FOR a shop
// { customerId, items: [{ productId, quantity }], addressId?, notes?, idempotencyKey, expectedTotal?, confirmNow? }
// Same rules as the shop's own checkout (its prices, stock, minimum qty); the shop's cart is untouched.
export const POST = withApi(async (req) => {
  const auth = await requireAdmin();
  const body = adminOrderCreateSchema.parse(await readJson(req));
  const result = await createOrderForShop(auth, body);
  return result.duplicate ? ok(result) : created(result);
});
