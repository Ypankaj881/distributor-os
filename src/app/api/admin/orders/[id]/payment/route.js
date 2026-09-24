import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { paymentStatusSchema } from "@/server/validators/order";
import { setPaymentStatus } from "@/server/services/orderWorkflow";
import { getAdminOrder } from "@/server/services/adminOrderService";

// PATCH /api/admin/orders/:id/payment — { paymentStatus: UNPAID|PARTIAL|PAID } (a manual record, no online payment)
export const PATCH = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const { paymentStatus } = paymentStatusSchema.parse(await readJson(req));
  await setPaymentStatus(auth.companyId, id, paymentStatus);
  return ok(await getAdminOrder(auth.companyId, id));
});
