import { NextResponse } from "next/server";
import { SESSION_COOKIE, decodeSession } from "./server/auth/session.js";
import { ROLES } from "./lib/constants.js";

// Proxy (called "middleware" before Next.js 16) runs before every matched request.
// It does two FAST jobs using only the signed cookie (no database):
//   1. Pages: redirect logged-out users to the right login page, and send
//      admins/retailers to their own area.
//   2. API: block cross-site write requests (CSRF defence in depth).
// Real authorization happens again in every page and API route (auth/guards.js).

const LOGIN_PAGES = new Set(["/login", "/admin/login"]);

export async function proxy(req) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/")) return checkSameOrigin(req);
  if (LOGIN_PAGES.has(pathname)) return NextResponse.next();

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const session = await decodeSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    const url = new URL(isAdminArea ? "/admin/login" : "/login", req.url);
    if (pathname !== "/" && pathname !== "/admin") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (isAdminArea && session.role !== ROLES.ADMIN) return NextResponse.redirect(new URL("/", req.url));
  if (!isAdminArea && session.role === ROLES.ADMIN) return NextResponse.redirect(new URL("/admin", req.url));

  return NextResponse.next();
}

// Browsers send an Origin header on cross-site POST/PATCH/DELETE. If it doesn't
// match our own host, another website is trying to act as the logged-in user.
function checkSameOrigin(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return NextResponse.next();

  const origin = req.headers.get("origin");
  if (!origin) return NextResponse.next(); // non-browser clients (curl, server-to-server)

  let originHost = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // "null" or malformed origin → treat as cross-site
  }

  if (originHost !== req.headers.get("host")) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Cross-site request blocked." } },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next.js internals and static files.
  // The app manifest, icons and service worker must be public (phones fetch
  // them before anyone logs in).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|app-icon/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt)$).*)"],
};
