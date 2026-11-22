import { chartList } from "@/lib/charts";
import { dict } from "@/lib/i18n";
import { href, isLang, regionOf } from "@/lib/locales";
import { providerList, sitemapPeople, sitemapTitles } from "@/lib/queries";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Mapa stránok pre jeden jazyk (max. 50 000 adries). */
export async function GET(_: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) return new Response("Not found", { status: 404 });
  const ctx = { lang, region: regionOf(lang) };
  const [titles, people, charts, provs] = await Promise.all([
    sitemapTitles(lang, 0, 40000).catch(() => []),
    sitemapPeople(8000).catch(() => []),
    chartList(ctx, dict(lang)).catch(() => []),
    providerList(ctx.region, 3).catch(() => []),
  ]);
  const u = (path: string, mod?: Date, freq = "daily") =>
    `<url><loc>${esc(SITE_URL + href(lang, path))}</loc>${mod ? `<lastmod>${mod.toISOString().slice(0, 10)}</lastmod>` : ""}<changefreq>${freq}</changefreq></url>`;
  const urls = [
    u("/"), u("/catalog"), u("/catalog?kind=movie"), u("/charts"), u("/calendar"), u("/pick", undefined, "weekly"),
    u("/platforms"), ...provs.map((p) => u(`/platform/${p.slug}`)), u("/about", undefined, "monthly"),
    ...charts.map((c) => u(`/charts/${c.key}`)),
    ...titles.map((t) => u(`/${t.kind}/${t.tmdb_id}-${t.slug}`, t.synced_at)),
    // „Podobné ako…“ len pre populárnejšie tituly (prvé 3000).
    ...titles.slice(0, 3000).map((t) => u(`/${t.kind}/${t.tmdb_id}-${t.slug}/similar`, undefined, "weekly")),
    ...people.map((p) => u(`/person/${p.id}-${p.slug}`, p.synced_at, "weekly")),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
