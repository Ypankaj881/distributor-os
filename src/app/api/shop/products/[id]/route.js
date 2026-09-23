import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { getShopProduct } from "@/server/services/catalogService";

// GET /api/shop/products/:id
export const GET = withApi(async (_req, { params }) => {
  const auth = await requireRetailer();
  const { id } = await params;
  return ok(await getShopProduct(auth.companyId, auth.customerId, id, auth.company.settings));
});
