// Private B2B app: ask search engines not to crawl anything.
// (Pages also send "noindex" via the root layout metadata.)
export default function robots() {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
