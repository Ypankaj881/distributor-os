import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { removeCustomerPrice } from "@/server/services/pricingService";

// DELETE /api/admin/customers/:id/prices/:productId — back to the default price
export const DELETE = withApi(async (_req, { params }) => {
  const auth = await requireAdmin();
  const { id, productId } = await params;
  return ok(await removeCustomerPrice(auth.companyId, id, productId, { userId: auth.userId }));
});
