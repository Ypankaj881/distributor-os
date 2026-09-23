import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { paramsToObject } from "@/server/validators/common";
import { priceListQuerySchema, setPricesSchema } from "@/server/validators/pricing";
import { listCustomerPriceRows, setCustomerPrices } from "@/server/services/pricingService";

// GET /api/admin/customers/:id/prices?q=&brandId=&view=all|special&page=
// Every product with its default price + this shop's current/upcoming special price.
export const GET = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const query = priceListQuerySchema.parse(paramsToObject(req.nextUrl.searchParams));
  const { rows, meta } = await listCustomerPriceRows(auth.companyId, id, query);
  return ok(rows, { meta });
});

// PUT /api/admin/customers/:id/prices
// { effectiveFrom?: "YYYY-MM-DD", effectiveTo?: "YYYY-MM-DD", prices: [{ productId, price (paise) }] }
export const PUT = withApi(async (req, { params }) => {
  const auth = await requireAdmin();
  const { id } = await params;
  const body = setPricesSchema.parse(await readJson(req));
  return ok(
    await setCustomerPrices(auth.companyId, id, body, {
      userId: auth.userId,
      timeZone: auth.company.settings?.timezone ?? "Asia/Kolkata",
    }),
  );
});
