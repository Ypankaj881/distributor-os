import { cookies } from "next/headers";
import { withApi, readJson } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { clientIp } from "@/server/http/request";
import { loginSchema } from "@/server/validators/auth";
import { login } from "@/server/services/authService";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { resolveCompanySlug } from "@/server/tenant";

// POST /api/auth/login
// Body: { portal: "admin" | "shop", identifier: "9876543210" | "admin@x.com", password }
export const POST = withApi(async (req) => {
  const body = loginSchema.parse(await readJson(req));

  const { token, redirectTo } = await login({
    ...body,
    companySlug: resolveCompanySlug(req),
    ip: clientIp(req),
  });

  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  return ok({ redirectTo });
});
