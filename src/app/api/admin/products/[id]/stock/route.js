import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { stockAdjustSchema } from "@/server/validators/product";
import { adjustStock } from "@/server/services/productService";

// POST /api/admin/products/:id/stock — { change: 50 } adds, { change: -3 } removes
export const POST = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const { change } = stockAdjustSchema.parse(await readJson(req));
  return ok(await adjustStock(auth.companyId, id, change, auth.company.settings));
});
