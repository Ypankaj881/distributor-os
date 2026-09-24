// Small fetch wrapper for client components. It always resolves (never throws)
// to { ok, data, error, status } so every form handles errors the same way:
//
//   const res = await api.post("/api/auth/login", body);
//   if (!res.ok) setError(res.error.message);
//
async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: { code: "NETWORK_ERROR", message: "Couldn't reach the server. Check your internet connection and try again." },
    };
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON response (e.g. a crashed proxy); handled below
  }

  if (res.ok && json?.success) return { ok: true, status: res.status, data: json.data, meta: json.meta };

  const error = json?.error ?? { code: "UNKNOWN", message: "Something went wrong. Please try again." };

  // Session expired / logged out elsewhere (password reset, deactivated):
  // send the user to the right login page, then back to where they were.
  if (res.status === 401 && error.code === "UNAUTHORIZED" && typeof window !== "undefined") {
    const here = window.location.pathname + window.location.search;
    const loginPath = here.startsWith("/admin") ? "/admin/login" : "/login";
    // A full page load on purpose: it wipes all in-memory state (cart, forms)
    // that belonged to the ended session. This helper isn't a component, so
    // there's no router to use anyway.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`${loginPath}?next=${encodeURIComponent(here)}`);
  }

  return { ok: false, status: res.status, error };
}

export const api = {
  get: (url) => request("GET", url),
  post: (url, body = {}) => request("POST", url, body),
  patch: (url, body = {}) => request("PATCH", url, body),
  put: (url, body = {}) => request("PUT", url, body),
  delete: (url) => request("DELETE", url),
};

// Only allow redirects to our own pages, never "//evil.com" or "https://…"
// (prevents open-redirect attacks via ?next=).
export function safeNextPath(next, fallback) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
