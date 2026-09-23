import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAuth } from "@/server/auth/guards";
import { toMeDTO } from "@/server/services/authService";

// GET /api/auth/me — the logged-in user and their company.
export const GET = withApi(async () => {
  const auth = await requireAuth();
  return ok(toMeDTO(auth));
});
