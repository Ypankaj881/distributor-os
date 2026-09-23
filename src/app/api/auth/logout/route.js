import { cookies } from "next/headers";
import { withApi } from "@/server/http/apiHandler";
import { ok } from "@/server/http/response";
import { SESSION_COOKIE } from "@/server/auth/session";

// POST /api/auth/logout — POST (not GET) so a link or image on another site
// can't log the user out.
export const POST = withApi(async () => {
  (await cookies()).delete(SESSION_COOKIE);
  return ok({ loggedOut: true });
});
