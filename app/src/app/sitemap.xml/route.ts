import { LANGS } from "@/lib/locales";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Index máp stránok: jedna mapa pre každý jazyk. */
export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${LANGS.map((l) => `  <sitemap><loc>${SITE_URL}/sitemap/${l}</loc></sitemap>`).join("\n")}
</sitemapindex>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
