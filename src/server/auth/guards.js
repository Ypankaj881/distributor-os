import { redirect } from "next/navigation";
import { getAuth } from "./current.js";
import { Errors } from "../http/errors.js";
import { ROLES } from "../../lib/constants.js";

// ---- API route guards: throw 401/403, which withApi() turns into JSON ----

async function requireApiRole(role) {
  const auth = await getAuth();
  if (!auth) throw Errors.unauthorized("Your session has expired. Please log in again.");
  if (role && auth.role !== role) throw Errors.forbidden();
  return auth;
}

export const requireAuth = () => requireApiRole(null);
export const requireAdmin = () => requireApiRole(ROLES.ADMIN);
export const requireRetailer = () => requireApiRole(ROLES.RETAILER);

// ---- Page guards: redirect instead of throwing ----
// These are the REAL protection for pages; proxy.js only does a fast early
// redirect based on the cookie and never touches the database.

export async function requireAdminPage() {
  const auth = await getAuth();
  if (!auth) redirect("/admin/login");
  if (auth.role !== ROLES.ADMIN) redirect("/");
  return auth;
}

export async function requireRetailerPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (auth.role !== ROLES.RETAILER) redirect("/admin");
  return auth;
}
