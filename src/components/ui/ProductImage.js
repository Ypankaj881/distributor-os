import { cn } from "./cn";

// Product images are admin-supplied URLs from any host. We use a plain <img>
// (lazy-loaded) instead of next/image, because next/image would require
// allowing ALL remote hosts, which turns our server into an open image proxy.
// When uploads are added (Cloudinary etc.), switch to next/image for that host.
function initials(name) {
  const words = String(name ?? "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

export default function ProductImage({ src, alt, className }) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-400", className)} aria-hidden="true">
        {initials(alt)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" className={cn("rounded-lg bg-slate-100 object-cover", className)} />
  );
}
