import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { shopProfileSchema } from "@/server/validators/customer";
import { getShopProfile, updateShopProfile } from "@/server/services/customerService";

// GET /api/shop/profile
export const GET = withApi(async () => {
  const auth = await requireRetailer();
  return ok(await getShopProfile(auth.companyId, auth.customerId));
});

// PATCH /api/shop/profile — { ownerName?, email? } (shop name / phone / GSTIN are set by the distributor)
export const PATCH = withApi(async (req) => {
  const auth = await requireRetailer();
  const patch = shopProfileSchema.parse(await readJson(req));
  return ok(await updateShopProfile(auth.companyId, auth.customerId, patch));
});
