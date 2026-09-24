import { ImageResponse } from "next/og";
import { getPublicCompany } from "@/server/services/authService";
import { config } from "@/server/config";

// GET /app-icon/192 | /app-icon/512 | /app-icon/180 (iPhone) [?maskable=1]
// A generated PNG app icon: the company's initials on the brand color.
// "maskable" icons keep the letters inside the safe zone Android may crop to.
const SIZES = new Set([180, 192, 512]);

function initials(name) {
  const words = String(name ?? "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "O";
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

export async function GET(req, { params }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const maskable = req.nextUrl.searchParams.has("maskable");

  let name = "";
  try {
    name = (await getPublicCompany(config.defaultCompanySlug()))?.name ?? "";
  } catch {
    // fall back to a generic letter
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2553e0",
          color: "white",
          fontSize: size * (maskable ? 0.32 : 0.42),
          fontWeight: 700,
          letterSpacing: -size * 0.01,
          borderRadius: maskable || size === 180 ? 0 : size * 0.22,
        }}
      >
        {initials(name)}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
