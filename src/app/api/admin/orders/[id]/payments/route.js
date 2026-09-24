import { withApi, readJson } from "@/server/http/apiHandler";
import { created } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { recordPaymentSchema } from "@/server/validators/order";
import { recordPayment } from "@/server/services/paymentService";
import { getAdminOrder } from "@/server/services/adminOrderService";

// POST /api/admin/orders/:id/payments — { amount (paise), mode, paidOn?, reference?, note? }
// Payment status (unpaid / partly paid / paid) is recalculated automatically; can't exceed the balance.
export const POST = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const body = recordPaymentSchema.parse(await readJson(req));
  await recordPayment(auth.companyId, id, body, { userId: auth.userId, name: auth.name }, { timeZone: auth.company.settings?.timezone });
  return created(await getAdminOrder(auth.companyId, id));
});
