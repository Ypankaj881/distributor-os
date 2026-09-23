import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "./session.js";
import { loadAuthContext } from "../services/authService.js";

// Returns the auth context for the current request, or null if not logged in.
// React's cache() makes repeated calls during ONE page render (layout + page +
// components) hit the database only once.
export const getAuth = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await decodeSession(token);
  return loadAuthContext(session);
});
