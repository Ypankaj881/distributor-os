import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { customerStatusSchema } from "@/server/validators/customer";
import { setCustomerActive } from "@/server/services/customerService";

// PATCH /api/admin/customers/:id/status — { isActive } ; deactivating logs the shop out everywhere
export const PATCH = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const { isActive } = customerStatusSchema.parse(await readJson(req));
  return ok(await setCustomerActive(auth.companyId, id, isActive));
});
