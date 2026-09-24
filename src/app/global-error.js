"use client"; // must be a client component and render its own <html>

// Last-resort error screen, used only if the root layout itself crashes.
// Page-level errors are handled by the nicer (shop)/error.js and admin error.js.
export default function GlobalError({ retry }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f8fafc" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#64748b", margin: "0 0 16px" }}>Please try again. If this keeps happening, contact the distributor.</p>
          <button type="button" onClick={() => retry()} style={{ padding: "10px 18px", borderRadius: 8, border: 0, background: "#2553e0", color: "#fff", fontSize: 15 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
