import { withApi, readJson } from "@/server/http/apiHandler";
import { ok, created } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { paramsToObject } from "@/server/validators/common";
import { productCreateSchema, productListQuerySchema } from "@/server/validators/product";
import { listProducts, createProduct } from "@/server/services/productService";

// GET /api/admin/products?q=&brandId=&status=all|active|inactive&stock=low|out&page=&limit=
export const GET = withApi(async (req) => {
  const auth = await requireAdmin();
  const query = productListQuerySchema.parse(paramsToObject(req.nextUrl.searchParams));
  const { items, meta } = await listProducts(auth.companyId, query, auth.company.settings);
  return ok(items, { meta });
});

// POST /api/admin/products — see productCreateSchema. Money fields are in paise.
export const POST = withApi(async (req) => {
  const auth = await requireAdmin();
  const data = productCreateSchema.parse(await readJson(req));
  return created(await createProduct(auth.companyId, data));
});
