import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { paramsToObject } from "@/server/validators/common";
import { shopProductQuerySchema } from "@/server/validators/catalog";
import { listShopProducts } from "@/server/services/catalogService";

// GET /api/shop/products?q=&brandId=&page=&limit=
// Prices are THIS shop's resolved prices; customerId comes from the session only.
export const GET = withApi(async (req) => {
  const auth = await requireRetailer();
  const query = shopProductQuerySchema.parse(paramsToObject(req.nextUrl.searchParams));
  const { items, meta } = await listShopProducts(auth.companyId, auth.customerId, query, auth.company.settings);
  return ok(items, { meta });
});
