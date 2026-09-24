import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAdmin } from "@/server/auth/guards";
import { companySettingsSchema } from "@/server/validators/company";
import { getCompanySettings, updateCompanySettings } from "@/server/services/companyService";

// GET /api/admin/settings
export const GET = withApi(async () => {
  const auth = await requireAdmin();
  return ok(await getCompanySettings(auth.companyId));
});

// PATCH /api/admin/settings — business details and order/stock/GST options
export const PATCH = withApi(async (req) => {
  const auth = await requireAdmin();
  const patch = companySettingsSchema.parse(await readJson(req));
  return ok(await updateCompanySettings(auth.companyId, patch));
});
