import { getTitle, genreNames, texts } from "@/lib/queries";
import { dict } from "@/lib/i18n";
import { ALL_LOCALES, isLang, DEFAULT_LANG } from "@/lib/locales";
import { img } from "@/lib/format";
import { ogImage, OG_SIZE } from "@/lib/og";
import { SITE } from "@/lib/site";

export const size = OG_SIZE;
export const contentType = "image/png";

/** Obrázok pri zdieľaní odkazu (Facebook, WhatsApp, X…): plagát, názov, hodnotenie a platformy. */
export default async function Image({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const p = await params;
  const lang = isLang(p.lang) ? p.lang : DEFAULT_LANG;
  const t = await getTitle("movie", Number(p.slug.split("-")[0]) || 0);
  const d = dict(lang);
  if (!t) return ogImage({ site: SITE, kind: "", title: SITE, meta: d.meta.tagline, score: null, poster: null, providers: [] });
  const genres = await genreNames(t.kind, t.genre_ids, lang);
  return ogImage({
    site: SITE, kind: t.kind === "movie" ? d.common.movie : d.common.tv, title: texts(t, lang).name,
    meta: [t.year, genres.slice(0, 2).join(", ")].filter(Boolean).join(" · "), score: t.score,
    poster: img(t.poster_path, "w500"), providers: (t.providers[ALL_LOCALES[lang].region] ?? []).map((x) => x.name),
  });
}
