import { SignJWT, jwtVerify } from "jose";
import { config } from "../config.js";

// A session is a signed JWT stored in an httpOnly cookie.
//  - Signed (HS256 with AUTH_SECRET): the browser can't alter it (e.g. change role).
//  - httpOnly: page JavaScript can't read it, so an XSS bug can't steal it.
//  - It holds IDs only; the user is re-loaded from the DB on each request
//    (see auth/current.js), so deactivation takes effect immediately.
//
// This file has no Next.js imports so it can also run inside proxy.js.

export const SESSION_COOKIE = "dos_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, in seconds

function secretKey() {
  return new TextEncoder().encode(config.authSecret());
}

export async function encodeSession(user) {
  return new SignJWT({
    cid: String(user.companyId),
    role: user.role,
    cust: user.customerId ? String(user.customerId) : null,
    tv: user.tokenVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user._id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

// Returns the session payload, or null if the token is missing, tampered with or expired.
export async function decodeSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return {
      userId: payload.sub,
      companyId: payload.cid,
      role: payload.role,
      customerId: payload.cust ?? null,
      tokenVersion: payload.tv ?? 0,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd, // HTTPS-only in production; localhost runs on http
    sameSite: "lax", // not sent on cross-site POSTs → basic CSRF protection
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
