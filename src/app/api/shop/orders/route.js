import { withApi, readJson } from "@/server/http/apiHandler";
import { ok, created } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { paramsToObject } from "@/server/validators/common";
import { placeOrderSchema, orderListQuerySchema } from "@/server/validators/order";
import { placeOrderFromCart, listShopOrders } from "@/server/services/orderService";

// GET /api/shop/orders?page= — the shop's own orders, newest first
export const GET = withApi(async (req) => {
  const auth = await requireRetailer();
  const query = orderListQuerySchema.parse(paramsToObject(req.nextUrl.searchParams));
  const { items, meta } = await listShopOrders(auth.companyId, auth.customerId, query);
  return ok(items, { meta });
});

// POST /api/shop/orders — { idempotencyKey, addressId?, notes?, expectedTotal? }
// Orders the CART's contents. Prices/totals from the request are never used.
// 201 = new order, 200 = this key was already used → the existing order is returned.
export const POST = withApi(async (req) => {
  const auth = await requireRetailer();
  const body = placeOrderSchema.parse(await readJson(req));
  const { order, duplicate } = await placeOrderFromCart(auth, body);
  return duplicate ? ok({ order, duplicate: true }) : created({ order, duplicate: false });
});
