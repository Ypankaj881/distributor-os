import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { confirmOrderSchema } from "@/server/validators/order";
import { confirmOrder } from "@/server/services/orderWorkflow";
import { getAdminOrder } from "@/server/services/adminOrderService";

// POST /api/admin/orders/:id/confirm — { quantities?: [{ itemId, confirmedQty }], note? }
// NEW → CONFIRMED. Deducts stock for the confirmed quantities (all-or-nothing).
export const POST = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const body = confirmOrderSchema.parse(await readJson(req));
  await confirmOrder(auth.companyId, id, body, { userId: auth.userId, name: auth.name, role: auth.role }, auth.company.settings);
  return ok(await getAdminOrder(auth.companyId, id));
});
