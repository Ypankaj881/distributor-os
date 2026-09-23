import { withApi, readJson } from "@/server/http/apiHandler";
import { ok, created } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { paramsToObject } from "@/server/validators/common";
import { customerCreateSchema, customerListQuerySchema } from "@/server/validators/customer";
import { listCustomers, createCustomer } from "@/server/services/customerService";

// GET /api/admin/customers?q=&status=all|active|inactive&page=&limit=
export const GET = withApi(async (req) => {
  const auth = await requireAdmin();
  const query = customerListQuerySchema.parse(paramsToObject(req.nextUrl.searchParams));
  const { items, meta } = await listCustomers(auth.companyId, query);
  return ok(items, { meta });
});

// POST /api/admin/customers — creates the shop AND its retailer login (phone + password)
export const POST = withApi(async (req) => {
  const auth = await requireAdmin();
  const data = customerCreateSchema.parse(await readJson(req));
  return created(await createCustomer(auth.companyId, data));
});
