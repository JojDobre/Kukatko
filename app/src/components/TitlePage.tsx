import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { deviceId, isPremium } from "@/lib/device";
import { followedIds, genreNames, getTitle, myRating, similar, texts, type TitleFull } from "@/lib/queries";
import { episodesFor, reviewsFor } from "@/lib/extra";
import { idSet, movieSeen } from "@/lib/features";
import TitleActions from "./TitleActions";
import { daysUntil, epCode, fmtDate, img, rel, todayISO, tone } from "@/lib/format";
import { dict, fmt, plural } from "@/lib/i18n";
import { ALL_LOCALES, type Lang } from "@/lib/locales";
import { platformStyle } from "@/lib/platforms";
import { personHref, titleHref } from "@/lib/page";
import { SITE, SITE_URL } from "@/lib/site";
import { alternates } from "@/lib/seo";
import { syncAllSeasonsOnce } from "@/lib/sync";
import { tmdbConfigured, type Kind } from "@/lib/tmdb";
import Poster, { Fallback, followHint } from "./Poster";
import FollowButton from "./FollowButton";
import Rate from "./Rate";
import AdSlot from "./AdSlot";
import Episodes from "./Episodes";
import Reviews from "./Reviews";
import { Play } from "./icons";

const idOf = (slug: string) => Number(slug.split("-")[0]) || 0;

export async function loadTitle(kind: Kind, slug: string) {
  const t = await getTitle(kind, idOf(slug));
  if (!t) notFound();
  return t;
}

export async function titleMetadata(t: TitleFull, lang: Lang) {
  const d = dict(lang);
  const tx = texts(t, lang);
  const region = ALL_LOCALES[lang].region;
  const where = (t.providers[region] ?? []).map((p) => p.name).join(", ");
  const desc = `${where ? fmt(d.title.metaWhere, { name: tx.name, where }) + " " : ""}${tx.overview ?? ""}`.slice(0, 158);
  return {
    title: fmt(d.title.metaTitle, { name: tx.name, year: t.year ?? "" }).replace(" ()", ""),
    description: desc,
    alternates: alternates(lang, (l) => `/${t.kind}/${t.tmdb_id}-${texts(t, l).slug}`),
    openGraph: { title: tx.name, description: desc, type: t.kind === "movie" ? "video.movie" as const : "video.tv_show" as const },
  };
}

export default async function TitlePage({ t, lang, slug }: { t: TitleFull; lang: Lang; slug: string }) {
  const d = dict(lang);
  const tx = texts(t, lang);
  if (slug !== `${t.tmdb_id}-${tx.slug}`) permanentRedirect(titleHref(lang, { kind: t.kind, tmdb_id: t.tmdb_id, slug: tx.slug }));

  const region = ALL_LOCALES[lang].region;
  const ctx = { lang, region };
  const dev = await deviceId();
  const fol = await followedIds(dev);
  const following = fol.has(t.id);
  // Seriál bez všetkých epizód: stiahneme ich na pozadí (raz), aby sa dali otvárať a odškrtávať.
  // Roboty vyhľadávačov sťahovanie nespúšťajú (inak by prehľadávanie webu zaťažilo TMDB).
  const bot = /bot|crawl|spider|slurp|preview/i.test((await headers()).get("user-agent") ?? "");
  if (t.kind === "tv" && !t.seasons_synced_at && !bot && tmdbConfigured()) after(() => syncAllSeasonsOnce(t.id).catch(() => {}));
  const [mine, sim, genres, eps, reviews, premium, wants, hides, seen] = await Promise.all([
    myRating(dev, t.id), similar(t, ctx), genreNames(t.kind, t.genre_ids, lang),
    t.kind === "tv" ? episodesFor(t.id, lang, dev) : Promise.resolve([]), reviewsFor(t.id, dev), isPremium(dev),
    idSet("want", dev), idSet("hidden", dev), t.kind === "movie" ? movieSeen(dev, t.id) : Promise.resolve(false),
  ]);
  const today = todayISO();
  const nd = daysUntil(t.next_air_date);
  const bg = img(t.backdrop_path, "w1280");
  const poster = img(t.poster_path, "w500");
  const userPct = t.user_count >= 5 && t.user_avg != null ? Math.round(t.user_avg * 10) : null;
  const providers = t.providers[region] ?? [];
  const trailer = t.trailers[lang] ?? t.trailers.en;
  const startSeason = t.next_ep?.season ?? t.last_ep?.season ?? eps.at(-1)?.season ?? 1;
  const nextName = t.next_ep ? eps.find((e) => e.season === t.next_ep!.season && e.episode === t.next_ep!.episode)?.name : null;
  const dateFmt = Object.fromEntries(eps.filter((e) => e.air_date).map((e) => [e.air_date!, fmtDate(e.air_date, lang)]));
  const status = t.status ? (d.title.status as Record<string, string>)[t.status] ?? t.status : null;
  const mineReview = reviews.find((r) => r.mine) ?? null;
  const toRow = (r: (typeof reviews)[number]) => ({ id: r.id, nickname: r.nickname, body: r.body, rating: r.rating, mine: r.mine, status: r.status,
    date: r.created_at.toLocaleDateString(ALL_LOCALES[lang].intl, { day: "numeric", month: "long", year: "numeric" }) });

  const jsonLd = {
    "@context": "https://schema.org", "@type": t.kind === "movie" ? "Movie" : "TVSeries", name: tx.name,
    alternateName: t.original_name !== tx.name ? t.original_name : undefined, description: tx.overview ?? undefined, image: poster ?? undefined,
    [t.kind === "movie" ? "datePublished" : "startDate"]: t.release_date ?? undefined, inLanguage: lang,
    numberOfSeasons: t.kind === "tv" ? t.seasons ?? undefined : undefined, genre: genres,
    url: `${SITE_URL}${titleHref(lang, { kind: t.kind, tmdb_id: t.tmdb_id, slug: tx.slug })}`,
    actor: t.cast.slice(0, 5).map((c) => ({ "@type": "Person", name: c.name })),
    director: t.kind === "movie" ? t.creators.map((n) => ({ "@type": "Person", name: n })) : undefined,
    aggregateRating: t.imdb_rating ? { "@type": "AggregateRating", ratingValue: t.imdb_rating, bestRating: 10, ratingCount: Math.max(1, t.tmdb_votes) } : undefined,
  };

  return (
    <div className="bento">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="dhero w4">
        <Fallback id={t.id} />
        {bg && <img className="bd" src={bg} alt="" fetchPriority="high" />}
        {poster && <img className="dposter" src={poster} alt={fmt(d.title.poster, { name: tx.name })} />}
        <div>
          <span className="kind">{t.kind === "movie" ? d.common.movie : d.common.tv}</span>
          <h1>{tx.name}</h1>
          {tx.tagline && <p className="tag">{tx.tagline}</p>}
          <p className="meta">
            {[t.year, genres.join(", "), t.kind === "tv" && t.seasons ? plural(d.common.seasons, t.seasons, lang) : null,
              t.runtime ? fmt(d.common.min, { n: t.runtime }) : null, status].filter(Boolean).join(" · ")}
          </p>
          {t.original_name !== tx.name && <p className="meta">{d.title.originalTitle}: {t.original_name}</p>}
        </div>
      </section>

      <div className="tile stat"><span className="lbl">{d.title.average}</span><span className="rv" style={{ color: tone(t.score) }}>{t.score != null ? `${t.score}%` : "–"}</span><span className="rs">{d.title.fromAll}</span></div>
      <div className="tile stat"><span className="lbl">IMDb</span><span className="rv">{t.imdb_rating?.toFixed(1) ?? "–"}</span>
        <span className="rs">{t.imdb_id ? <a href={`https://www.imdb.com/title/${t.imdb_id}/`} target="_blank" rel="noopener">{d.title.outOf10} · {d.title.openImdb}</a> : d.title.outOf10}</span></div>
      <div className="tile stat"><span className="lbl">Rotten Tomatoes</span><span className="rv">{t.rt_rating != null ? `${t.rt_rating}%` : "–"}</span><span className="rs">{d.title.critics}</span></div>
      <div className="tile stat"><span className="lbl">TMDB</span><span className="rv">{t.tmdb_rating?.toFixed(1) ?? "–"}</span><span className="rs">{plural(d.title.votes, t.tmdb_votes, lang)}</span></div>

      <div className="tile w3">
        <p className="prose">{tx.overview ?? d.title.noOverview}</p>
        {t.next_ep && nd != null && nd >= 0 && (
          <p><b>{d.title.nextEpisode}:</b> {epCode(t.next_ep.season, t.next_ep.episode)}{nextName ? ` · ${nextName}` : ""} · {fmtDate(t.next_air_date, lang)} ({rel(nd, lang)})</p>
        )}
        <FollowButton titleId={t.id} name={tx.name} initial={following} variant="full" kind={t.kind} hint={followHint({ kind: t.kind, next_ep: t.next_ep, next_air_date: t.next_air_date }, lang)} />
        <TitleActions titleId={t.id} kind={t.kind} want={wants.has(t.id)} hidden={hides.has(t.id)} seen={seen} />
        {t.creators.length > 0 && <p className="muted">{t.kind === "movie" ? d.title.directors : d.title.creators}: {t.creators.join(", ")}</p>}
      </div>

      <div className="tile rate">
        <span className="lbl">{SITE}</span>
        <span className="rv">{userPct != null ? `${userPct}%` : "–"}</span>
        <span className="rs">{plural(d.title.userRatings, t.user_count, lang)}{userPct == null ? ` ${d.title.shownFrom5}` : ""}</span>
        <span className="lbl" style={{ marginTop: 6 }}>{d.title.yourRating}</span>
        <Rate titleId={t.id} initial={mine} />
      </div>

      <div className={`tile ${t.kind === "movie" && !trailer ? "w4" : "w2"}`}>
        <span className="lbl"><span>{d.title.whereToWatch}</span><span>{ALL_LOCALES[lang].regionName}</span></span>
        {providers.length ? providers.map((p) => {
          const st = platformStyle(p.name);
          return (
            <a key={p.id} className="wl" href={`/out/${t.id}/${p.id}?r=${region}`} target="_blank" rel="noopener sponsored nofollow">
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {p.logo_path ? <img src={img(p.logo_path, "w92")!} alt="" /> : <span className="pl" style={{ background: st.color }}>{st.short}</span>}
                {p.name}
              </span>
              <small>{p.type === "flatrate" ? d.title.flatrate : p.type === "free" ? d.title.free : d.title.ads} →</small>
            </a>
          );
        }) : <p className="muted">{fmt(d.title.notAvailable, { region: ALL_LOCALES[lang].regionName })}</p>}
        <small className="muted">{d.title.availabilityNote}</small>
      </div>

      {t.kind === "tv" ? (
        <div className="tile w2">
          <span className="lbl"><span>{d.title.episodes}</span></span>
          {eps.length
            ? <Episodes titleId={t.id} base={titleHref(lang, { kind: t.kind, tmdb_id: t.tmdb_id, slug: tx.slug })} eps={eps} startSeason={startSeason} today={today} dateFmt={dateFmt} />
            : <p className="muted">{t.seasons && !t.seasons_synced_at ? d.watched.loading : t.status === "Ended" || t.status === "Canceled" ? d.title.ended : d.title.noNewSeason}</p>}
        </div>
      ) : null}

      {trailer && (
        <div className="tile w2">
          <span className="lbl">{d.title.trailer}</span>
          <a className="trailer" href={`https://www.youtube.com/watch?v=${trailer}`} target="_blank" rel="noopener">
            <img src={`https://i.ytimg.com/vi/${trailer}/hqdefault.jpg`} alt={`${d.title.trailer}: ${tx.name}`} loading="lazy" />
            <span><i><Play /></i></span>
          </a>
        </div>
      )}

      {t.cast.length > 0 && (
        <div className={`tile ${trailer ? "w2" : "w4"}`}>
          <span className="lbl">{d.title.cast}</span>
          <div className="cast">
            {t.cast.map((c) => (
              <Link key={`${c.id}-${c.name}`} href={personHref(lang, { id: c.id })} className="person">
                {c.profile_path ? <img className="av" src={img(c.profile_path, "w185")!} alt="" loading="lazy" />
                  : <span className="av avx">{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>}
                {c.name}{c.character && <small>{c.character}</small>}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="tile w4">
        <span className="lbl"><span>{d.reviews.title}</span><span>{reviews.filter((r) => r.status === "visible").length}</span></span>
        <Reviews titleId={t.id} reviews={reviews.filter((r) => !r.mine).map(toRow)} mine={mineReview ? toRow(mineReview) : null} />
      </div>

      <AdSlot place="title" hidden={premium} />

      {sim.length > 0 && (
        <div className="tile w4">
          <div className="cathead"><h2>{d.title.similar}</h2>
            <Link className="btn soft" href={`${titleHref(lang, { kind: t.kind, tmdb_id: t.tmdb_id, slug: tx.slug })}/similar`}>{d.similar.more}</Link></div>
          <div className="posters">{sim.map((x) => <Poster key={x.id} s={x} lang={lang} followed={fol.has(x.id)} />)}</div>
        </div>
      )}
    </div>
  );
}

