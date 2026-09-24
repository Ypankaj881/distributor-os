import { cookies } from "next/headers";
import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { requireAuth } from "@/server/auth/guards";
import { changePasswordSchema } from "@/server/validators/company";
import { changePassword } from "@/server/services/authService";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";

// POST /api/auth/password — { currentPassword, newPassword } (any logged-in user)
export const POST = withApi(async (req) => {
  const auth = await requireAuth();
  const body = changePasswordSchema.parse(await readJson(req));
  const { token } = await changePassword(auth, body);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions()); // keep THIS device logged in
  return ok({ changed: true });
});
