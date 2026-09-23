import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { customerUpdateSchema } from "@/server/validators/customer";
import { getCustomer, updateCustomer } from "@/server/services/customerService";

// GET /api/admin/customers/:id
export const GET = withApi(async (_req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  return ok(await getCustomer(auth.companyId, id));
});

// PATCH /api/admin/customers/:id — partial update. Changing phone also changes the login ID.
export const PATCH = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const patch = customerUpdateSchema.parse(await readJson(req));
  return ok(await updateCustomer(auth.companyId, id, patch));
});
