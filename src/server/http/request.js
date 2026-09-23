// Best-effort client IP. On Vercel (and most proxies) the real client IP is the
// first entry of x-forwarded-for. Only used for rate limiting, never for auth.
export function clientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
