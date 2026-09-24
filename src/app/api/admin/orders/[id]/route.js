import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { getAdminOrder } from "@/server/services/adminOrderService";

// GET /api/admin/orders/:id
export const GET = withApi(async (_req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  return ok(await getAdminOrder(auth.companyId, id));
});
