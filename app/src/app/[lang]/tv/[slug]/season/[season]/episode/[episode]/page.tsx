import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { deviceId } from "@/lib/device";
import { episodeNeighbors, episodesFor, myEpisodeState, reviewsFor } from "@/lib/extra";
import { texts } from "@/lib/queries";
import { epCode, fmtDate, img, todayISO, tone } from "@/lib/format";
import { fmt, plural } from "@/lib/i18n";
import { ALL_LOCALES } from "@/lib/locales";
import { platformStyle } from "@/lib/platforms";
import { page, personHref, titleHref } from "@/lib/page";
import { alternates } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { Fallback } from "@/components/Poster";
import Rate from "@/components/Rate";
import Reviews from "@/components/Reviews";
import EpisodeWatched from "@/components/EpisodeWatched";
import { loadEpisode, type EpParams } from "./data";

export const dynamic = "force-dynamic";

const pick = (m: Record<string, string>, lang: string) => m[lang] ?? m.en ?? null;

export async function generateMetadata({ params }: { params: EpParams }): Promise<Metadata> {
  const { lang, d } = await page(params);
  const { t, e, season, episode } = await loadEpisode(params);
  const show = texts(t, lang).name;
  const name = pick(e.names, lang) ?? fmt(d.episode.episode, { n: episode });
  const overview = pick(e.overviews, lang);
  return {
    title: fmt(d.episode.metaTitle, { show, code: epCode(season, episode), name }),
    description: (overview ?? fmt(d.episode.metaDesc, { show, season, episode, name })).slice(0, 158),
    alternates: alternates(lang, (l) => `/tv/${t.tmdb_id}-${texts(t, l).slug}/season/${season}/episode/${episode}`),
    openGraph: { type: "video.episode" },
  };
}

export default async function EpisodePage({ params }: { params: EpParams }) {
  const { lang, d } = await page(params);
  const { t, e, season, episode, slug } = await loadEpisode(params);
  const tx = texts(t, lang);
  const showHref = titleHref(lang, { kind: "tv", tmdb_id: t.tmdb_id, slug: tx.slug });
  if (slug !== `${t.tmdb_id}-${tx.slug}`) permanentRedirect(`${showHref}/season/${season}/episode/${episode}`);

  const dev = await deviceId();
  const [nb, mine, reviews, seasonEps] = await Promise.all([
    episodeNeighbors(t.id, season, episode), myEpisodeState(dev, t.id, season, episode),
    reviewsFor(t.id, dev, 30, season, episode), episodesFor(t.id, lang, dev),
  ]);
  const today = todayISO();
  const aired = !!e.air_date && e.air_date <= today;
  const name = pick(e.names, lang) ?? fmt(d.episode.episode, { n: episode });
  const overview = pick(e.overviews, lang);
  const userPct = e.user_count >= 3 && e.user_avg != null ? Math.round(e.user_avg * 10) : null;
  const tmdbPct = e.tmdb_votes >= 5 && e.tmdb_rating != null ? Math.round(e.tmdb_rating * 10) : null;
  const score = userPct ?? tmdbPct;
  const still = img(e.still_path, "w1280") ?? img(t.backdrop_path, "w1280");
  const region = ALL_LOCALES[lang].region;
  const providers = t.providers[region] ?? [];
  const epHref = (s: number, n: number) => `${showHref}/season/${s}/episode/${n}`;
  const inSeason = seasonEps.filter((x) => x.season === season);
  const mineReview = reviews.find((r) => r.mine) ?? null;
  const toRow = (r: (typeof reviews)[number]) => ({ id: r.id, nickname: r.nickname, body: r.body, rating: r.rating, mine: r.mine, status: r.status,
    date: r.created_at.toLocaleDateString(ALL_LOCALES[lang].intl, { day: "numeric", month: "long", year: "numeric" }) });

  const ld = {
    "@context": "https://schema.org", "@type": "TVEpisode", name, episodeNumber: episode, description: overview ?? undefined,
    datePublished: e.air_date ?? undefined, image: img(e.still_path, "w780") ?? undefined, inLanguage: lang,
    url: `${SITE_URL}${epHref(season, episode)}`,
    partOfSeason: { "@type": "TVSeason", seasonNumber: season },
    partOfSeries: { "@type": "TVSeries", name: tx.name, url: `${SITE_URL}${showHref}` },
    director: e.directors.map((n) => ({ "@type": "Person", name: n })),
    aggregateRating: e.tmdb_votes >= 5 && e.tmdb_rating ? { "@type": "AggregateRating", ratingValue: e.tmdb_rating, bestRating: 10, ratingCount: e.tmdb_votes } : undefined,
  };

  return (
    <div className="bento">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <section className="dhero w4 ephero">
        <Fallback id={t.id + season * 31 + episode} />
        {still && <img className="bd" src={still} alt="" fetchPriority="high" />}
        <div>
          <Link href={showHref} className="kind">{tx.name}</Link>
          <p className="mono epcode">{epCode(season, episode)}</p>
          <h1>{name}</h1>
          <p className="meta">
            {[fmt(d.episode.season, { n: season }), e.air_date ? fmtDate(e.air_date, lang, { day: "numeric", month: "long", year: "numeric" }) : null,
              e.runtime ? fmt(d.common.min, { n: e.runtime }) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </section>

      <div className="tile stat"><span className="lbl">{d.episode.rating}</span><span className="rv" style={{ color: tone(score) }}>{score != null ? `${score}%` : "–"}</span>
        <span className="rs">{userPct != null ? `${plural(d.title.userRatings, e.user_count, lang)}` : tmdbPct != null ? "TMDB" : d.title.shownFrom5}</span></div>
      <div className="tile stat"><span className="lbl">TMDB</span><span className="rv">{e.tmdb_rating != null && e.tmdb_votes ? e.tmdb_rating.toFixed(1) : "–"}</span>
        <span className="rs">{plural(d.title.votes, e.tmdb_votes, lang)}</span></div>
      <div className="tile w2 rate">
        <span className="lbl">{d.episode.yourRating}</span>
        {aired ? <Rate titleId={t.id} initial={mine.rating} endpoint="/api/rate-episode" extra={{ season, episode }} /> : <p className="muted">{d.episode.notAired}</p>}
      </div>

      <div className="tile w3">
        <p className="prose">{overview ?? d.episode.noOverview}</p>
        <div className="frow">
          <EpisodeWatched titleId={t.id} season={season} episode={episode} initial={mine.watched} disabled={!aired} />
        </div>
        {(e.directors.length > 0 || e.writers.length > 0) && (
          <dl className="facts">
            {e.directors.length > 0 && <><dt>{d.episode.directedBy}</dt><dd>{e.directors.join(", ")}</dd></>}
            {e.writers.length > 0 && <><dt>{d.episode.writtenBy}</dt><dd>{e.writers.join(", ")}</dd></>}
          </dl>
        )}
      </div>
      <nav className="tile epnav" aria-label={d.title.episodes}>
        {nb.prev ? <Link className="btn soft" href={epHref(nb.prev.season, nb.prev.episode)}>‹ {d.episode.prev} · {epCode(nb.prev.season, nb.prev.episode)}</Link> : <span />}
        {nb.next ? <Link className="btn soft" href={epHref(nb.next.season, nb.next.episode)}>{d.episode.next} · {epCode(nb.next.season, nb.next.episode)} ›</Link> : <span />}
        <Link className="link" href={showHref}>{d.episode.back}</Link>
      </nav>

      {providers.length > 0 && (
        <div className="tile w2">
          <span className="lbl"><span>{d.title.whereToWatch}</span><span>{ALL_LOCALES[lang].regionName}</span></span>
          {providers.map((p) => {
            const st = platformStyle(p.name);
            return (
              <a key={p.id} className="wl" href={`/out/${t.id}/${p.id}?r=${region}`} target="_blank" rel="noopener sponsored nofollow">
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {p.logo_path ? <img src={img(p.logo_path, "w92")!} alt="" /> : <span className="pl" style={{ background: st.color }}>{st.short}</span>}{p.name}
                </span>
                <small>{p.type === "flatrate" ? d.title.flatrate : p.type === "free" ? d.title.free : d.title.ads} →</small>
              </a>
            );
          })}
        </div>
      )}

      {e.guests.length > 0 && (
        <div className={`tile ${providers.length ? "w2" : "w4"}`}>
          <span className="lbl">{d.episode.guests}</span>
          <div className="cast">
            {e.guests.map((g) => (
              <Link key={`${g.id}-${g.name}`} href={personHref(lang, { id: g.id })} className="person">
                {g.profile_path ? <img className="av" src={img(g.profile_path, "w185")!} alt="" loading="lazy" />
                  : <span className="av avx">{g.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>}
                {g.name}{g.character && <small>{g.character}</small>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {aired && (
        <div className="tile w4">
          <span className="lbl"><span>{d.episode.reviews}</span><span>{reviews.filter((r) => r.status === "visible").length}</span></span>
          <Reviews titleId={t.id} season={season} episode={episode} reviews={reviews.filter((r) => !r.mine).map(toRow)} mine={mineReview ? toRow(mineReview) : null} />
        </div>
      )}

      {inSeason.length > 1 && (
        <div className="tile w4">
          <span className="lbl"><span>{fmt(d.episode.season, { n: season })}</span><span>{inSeason.length}</span></span>
          <div className="epstrip">
            {inSeason.map((x) => (
              <Link key={x.episode} href={epHref(x.season, x.episode)} className={`epcard${x.episode === episode ? " cur" : ""}${x.watched ? " seen" : ""}`} aria-current={x.episode === episode ? "page" : undefined}>
                <span className="epimg">{x.still_path ? <img src={img(x.still_path, "w185")!} alt="" loading="lazy" /> : <span className="mono">E{x.episode}</span>}</span>
                <span className="mono muted small">{epCode(x.season, x.episode)}{x.score != null ? ` · ${x.score}%` : ""}</span>
                <span className="small">{x.name ?? `E${x.episode}`}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

