import Link from "next/link";
import { deviceId } from "@/lib/device";
import { followedIds, similar, texts, type TitleFull } from "@/lib/queries";
import { dict, fmt } from "@/lib/i18n";
import { ALL_LOCALES, type Lang } from "@/lib/locales";
import { titleHref } from "@/lib/page";
import { alternates } from "@/lib/seo";
import Poster from "./Poster";

export function similarMetadata(t: TitleFull, lang: Lang) {
  const d = dict(lang).similar;
  const name = texts(t, lang).name;
  return {
    title: fmt(t.kind === "movie" ? d.titleMovie : d.titleTv, { name }),
    description: fmt(d.metaDesc, { name }),
    alternates: alternates(lang, (l) => `/${t.kind}/${t.tmdb_id}-${texts(t, l).slug}/similar`),
  };
}

/** „Seriály podobné ako X“: samostatná stránka (vyhľadávanie „podobné ako…“). */
export default async function SimilarPage({ t, lang }: { t: TitleFull; lang: Lang }) {
  const d = dict(lang);
  const tx = texts(t, lang);
  const ctx = { lang, region: ALL_LOCALES[lang].region };
  const [rows, fol] = await Promise.all([similar(t, ctx, 36), followedIds(await deviceId())]);
  const ld = { "@context": "https://schema.org", "@type": "ItemList", itemListElement: rows.slice(0, 20).map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.name })) };
  return (
    <div className="bento">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <div className="tile w4">
        <div className="cathead">
          <h1>{fmt(t.kind === "movie" ? d.similar.titleMovie : d.similar.titleTv, { name: tx.name })}<small>{rows.length}</small></h1>
          <Link className="btn soft" href={titleHref(lang, { kind: t.kind, tmdb_id: t.tmdb_id, slug: tx.slug })}>{fmt(d.similar.back, { name: tx.name })}</Link>
        </div>
        <p className="muted">{fmt(d.similar.metaDesc, { name: tx.name })}</p>
        <div className="posters">
          {rows.length ? rows.map((s, i) => <Poster key={s.id} s={s} lang={lang} followed={fol.has(s.id)} priority={i < 6} />)
            : <div className="empty">{d.catalog.empty}</div>}
        </div>
      </div>
    </div>
  );
}
