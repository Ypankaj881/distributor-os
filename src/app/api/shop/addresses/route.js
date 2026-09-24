import { withApi, readJson } from "@/server/http/apiHandler";
import { ok, created } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { shopAddressCreateSchema } from "@/server/validators/customer";
import { getShopAddresses, addShopAddress } from "@/server/services/customerService";

// GET /api/shop/addresses
export const GET = withApi(async () => {
  const auth = await requireRetailer();
  return ok(await getShopAddresses(auth.companyId, auth.customerId));
});

// POST /api/shop/addresses — returns the full updated list
export const POST = withApi(async (req) => {
  const auth = await requireRetailer();
  const data = shopAddressCreateSchema.parse(await readJson(req));
  return created(await addShopAddress(auth.companyId, auth.customerId, data));
});
