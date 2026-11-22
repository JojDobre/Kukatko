import { sql } from "@/lib/db";
import { icalEpisodes } from "@/lib/features";
import { buildIcal } from "@/lib/ical";
import { epCode } from "@/lib/format";
import { DEFAULT_LANG, href, isLang } from "@/lib/locales";
import { SITE, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Kalendár sledovaných seriálov pre Google/Apple kalendár (odkaz s tajným kľúčom). */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return new Response("Not found", { status: 404 });
  const [d] = await sql<{ id: string; lang: string }[]>`SELECT id, lang FROM devices WHERE ical_token = ${token}`;
  if (!d) return new Response("Not found", { status: 404 });
  const lang = isLang(d.lang) ? d.lang : DEFAULT_LANG;
  const eps = await icalEpisodes(d.id, lang);
  const body = buildIcal(SITE, eps.map((e) => ({
    uid: `${e.kind}-${e.tmdb_id}-${e.season}-${e.episode}@kukatko`,
    date: e.date,
    summary: `${e.name} ${epCode(e.season, e.episode)}${e.ep_name ? ` · ${e.ep_name}` : ""}`,
    description: e.providers ?? undefined,
    url: `${SITE_URL}${href(lang, `/${e.kind}/${e.tmdb_id}-${e.slug}`)}`,
  })));
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=1800" } });
}
