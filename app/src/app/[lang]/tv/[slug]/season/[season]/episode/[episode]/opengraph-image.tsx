import { dict, fmt } from "@/lib/i18n";
import { ALL_LOCALES, DEFAULT_LANG, isLang } from "@/lib/locales";
import { epCode, img } from "@/lib/format";
import { getEpisode } from "@/lib/extra";
import { getTitle, texts } from "@/lib/queries";
import { ogImage, OG_SIZE } from "@/lib/og";
import { SITE } from "@/lib/site";

export const size = OG_SIZE;
export const contentType = "image/png";

/** Obrázok pri zdieľaní epizódy: plagát seriálu, kód a názov epizódy, hodnotenie. */
export default async function Image({ params }: { params: Promise<{ lang: string; slug: string; season: string; episode: string }> }) {
  const p = await params;
  const lang = isLang(p.lang) ? p.lang : DEFAULT_LANG;
  const d = dict(lang);
  const t = await getTitle("tv", Number(p.slug.split("-")[0]) || 0);
  const s = Number(p.season), n = Number(p.episode);
  const e = t ? await getEpisode(t.id, s, n) : null;
  if (!t || !e) return ogImage({ site: SITE, kind: "", title: SITE, meta: d.meta.tagline, score: null, poster: null, providers: [] });
  const score = e.user_count >= 3 && e.user_avg != null ? Math.round(e.user_avg * 10) : e.tmdb_votes >= 5 && e.tmdb_rating != null ? Math.round(e.tmdb_rating * 10) : null;
  return ogImage({
    site: SITE, kind: "", label: `${texts(t, lang).name} · ${epCode(s, n)}`,
    title: e.names[lang] ?? e.names.en ?? fmt(d.episode.episode, { n }),
    meta: [fmt(d.episode.season, { n: s }), e.air_date?.slice(0, 4)].filter(Boolean).join(" · "),
    score, poster: img(t.poster_path, "w500"), providers: (t.providers[ALL_LOCALES[lang].region] ?? []).map((x) => x.name),
  });
}
