import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { listShopBrands } from "@/server/services/catalogService";

// GET /api/shop/brands — brands the logged-in shop can browse
export const GET = withApi(async () => {
  const auth = await requireRetailer();
  return ok(await listShopBrands(auth.companyId));
});
