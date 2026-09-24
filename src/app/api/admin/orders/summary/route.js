import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { getNewOrdersSummary } from "@/server/services/adminOrderService";

// GET /api/admin/orders/summary — { newCount, latest } for the live new-order alert
export const GET = withApi(async () => {
  const auth = await requireAdmin();
  return ok(await getNewOrdersSummary(auth.companyId));
});
