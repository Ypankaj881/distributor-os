import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { productUpdateSchema } from "@/server/validators/product";
import { getProduct, updateProduct, archiveProduct } from "@/server/services/productService";

// GET /api/admin/products/:id
export const GET = withApi(async (_req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  return ok(await getProduct(auth.companyId, id));
});

// PATCH /api/admin/products/:id — partial update (stock is changed via /stock)
export const PATCH = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const patch = productUpdateSchema.parse(await readJson(req));
  return ok(await updateProduct(auth.companyId, id, patch));
});

// DELETE /api/admin/products/:id — soft delete (kept for order history)
export const DELETE = withApi(async (_req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  return ok(await archiveProduct(auth.companyId, id));
});
