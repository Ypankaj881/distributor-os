import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { adminOrderPreviewSchema } from "@/server/validators/order";
import { previewOrderForShop } from "@/server/services/orderService";

// POST /api/admin/orders/preview — { customerId, items } → lines priced at THAT
// shop's prices, issues, totals, and the shop's delivery addresses.
export const POST = withApi(async (req) => {
  const auth = await requireAdmin();
  const body = adminOrderPreviewSchema.parse(await readJson(req));
  return ok(await previewOrderForShop(auth, body));
});
