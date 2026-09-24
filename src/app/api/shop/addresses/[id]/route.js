import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireRetailer } from "@/server/auth/guards";
import { shopAddressUpdateSchema } from "@/server/validators/customer";
import { updateShopAddress, deleteShopAddress } from "@/server/services/customerService";

// PATCH /api/shop/addresses/:id — edit, or { isDefault: true } to make it the default
export const PATCH = withApi(async (req, { params }) => {
  const auth = await requireRetailer();
  const { id } = await params;
  const patch = shopAddressUpdateSchema.parse(await readJson(req));
  return ok(await updateShopAddress(auth.companyId, auth.customerId, id, patch));
});

// DELETE /api/shop/addresses/:id
export const DELETE = withApi(async (_req, { params }) => {
  const auth = await requireRetailer();
  const { id } = await params;
  return ok(await deleteShopAddress(auth.companyId, auth.customerId, id));
});
