import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { orderStatusSchema } from "@/server/validators/order";
import { transitionOrder } from "@/server/services/orderWorkflow";
import { getAdminOrder } from "@/server/services/adminOrderService";

// PATCH /api/admin/orders/:id/status — { status: PACKED|DISPATCHED|DELIVERED|CANCELLED|REJECTED, note }
// Only allowed transitions are accepted; cancelling a confirmed order returns stock.
export const PATCH = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const body = orderStatusSchema.parse(await readJson(req));
  await transitionOrder(auth.companyId, id, body, { userId: auth.userId, name: auth.name, role: auth.role });
  return ok(await getAdminOrder(auth.companyId, id));
});
