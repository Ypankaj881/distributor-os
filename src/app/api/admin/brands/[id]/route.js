import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { brandUpdateSchema } from "@/server/validators/brand";
import { updateBrand, deleteBrand } from "@/server/services/brandService";

// PATCH /api/admin/brands/:id — any of { name, logoUrl, sortOrder, isActive }
export const PATCH = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const patch = brandUpdateSchema.parse(await readJson(req));
  return ok(await updateBrand(auth.companyId, id, patch));
});

// DELETE /api/admin/brands/:id — soft delete; refused if the brand has products
export const DELETE = withApi(async (_req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  return ok(await deleteBrand(auth.companyId, id));
});
