import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { customerPasswordSchema } from "@/server/validators/customer";
import { resetCustomerPassword } from "@/server/services/customerService";

// POST /api/admin/customers/:id/password — { password } ; logs the shop out everywhere
export const POST = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const { password } = customerPasswordSchema.parse(await readJson(req));
  return ok(await resetCustomerPassword(auth.companyId, id, password));
});
