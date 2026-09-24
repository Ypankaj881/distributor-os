import { getPublicCompany } from "@/server/services/authService";
import { config } from "@/server/config";

// Web app manifest (served at /manifest.webmanifest): lets shops "install" the
// ordering app on their phone's home screen, opening full-screen like an app.
// The name comes from the company record — nothing hard-coded.
export default async function manifest() {
  let name = "B2B Ordering Portal";
  try {
    name = (await getPublicCompany(config.defaultCompanySlug()))?.name ?? name;
  } catch {
    // database unreachable at this moment → generic name; icons/links still work
  }
  return {
    name: `${name} — Orders`,
    short_name: name.length > 12 ? name.split(" ")[0] : name,
    description: `Order from ${name}`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#2553e0",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
