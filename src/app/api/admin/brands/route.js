import { withApi, readJson } from "@/server/http/apiHandler";
import { ok, created } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { brandCreateSchema } from "@/server/validators/brand";
import { listBrands, createBrand } from "@/server/services/brandService";

// GET /api/admin/brands — all brands with product counts
export const GET = withApi(async () => {
  const auth = await requireAdmin();
  return ok(await listBrands(auth.companyId));
});

// POST /api/admin/brands — { name, logoUrl?, sortOrder?, isActive? }
export const POST = withApi(async (req) => {
  const auth = await requireAdmin();
  const data = brandCreateSchema.parse(await readJson(req));
  return created(await createBrand(auth.companyId, data));
});
