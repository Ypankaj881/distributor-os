import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { getDashboard } from "@/server/services/dashboardService";

// GET /api/admin/dashboard — today's / this month's numbers, pipeline, 14-day sales, low stock
export const GET = withApi(async () => {
  const auth = await requireAdmin();
  return ok(await getDashboard(auth.companyId, auth.company.settings));
});
