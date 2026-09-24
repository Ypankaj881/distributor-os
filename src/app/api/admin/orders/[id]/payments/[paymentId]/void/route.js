import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { voidPaymentSchema } from "@/server/validators/order";
import { voidPayment } from "@/server/services/paymentService";
import { getAdminOrder } from "@/server/services/adminOrderService";

// POST /api/admin/orders/:id/payments/:paymentId/void — { reason }
// Cancels a wrongly recorded payment; it stays in the history, totals are recalculated.
export const POST = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id, paymentId } = await params;
  const { reason } = voidPaymentSchema.parse(await readJson(req));
  await voidPayment(auth.companyId, id, paymentId, { reason }, { userId: auth.userId, name: auth.name });
  return ok(await getAdminOrder(auth.companyId, id));
});
