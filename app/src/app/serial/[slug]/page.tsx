import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { deviceId } from "@/lib/device";
import { followedIds, getShow, myRating, similar } from "@/lib/queries";
import { daysUntil, epCode, fmtDate, img, plural, rel, todayISO, tone } from "@/lib/format";
import { AFFILIATE, platformStyle } from "@/lib/platforms";
import { SITE_URL } from "@/lib/site";
import Poster, { Fallback, nextLabel, showHref } from "@/components/Poster";
import FollowButton from "@/components/FollowButton";
import Rate from "@/components/Rate";
import AdSlot from "@/components/AdSlot";
import { Play } from "@/components/icons";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
const idOf = (slug: string) => Number(slug.split("-")[0]) || 0;

const STATUS: Record<string, string> = {
  "Returning Series": "Pokračuje", Ended: "Ukončený", Canceled: "Zrušený", "In Production": "Vo výrobe", Planned: "Plánovaný", Pilot: "Pilot",
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const s = await getShow(idOf((await params).slug));
  if (!s) return { title: "Seriál sa nenašiel" };
  const where = s.providers.map((p) => p.name).join(", ");
  const desc = `${where ? `${s.name} pozeraj na ${where}. ` : ""}${s.overview ?? ""}`.slice(0, 158);
  const image = img(s.backdrop_path, "w1280") ?? img(s.poster_path, "w780");
  return {
    title: `${s.name}${s.year ? ` (${s.year})` : ""}: kde pozerať`,
    description: desc,
    alternates: { canonical: showHref(s) },
    openGraph: { title: s.name, description: desc, images: image ? [image] : [], type: "video.tv_show" },
  };
}

export default async function ShowPage({ params }: { params: Params }) {
  const { slug } = await params;
  const s = await getShow(idOf(slug));
  if (!s) notFound();
  if (slug !== `${s.id}-${s.slug}`) permanentRedirect(showHref(s));

  const dev = await deviceId();
  const [fol, mine, sim] = await Promise.all([followedIds(dev), myRating(dev, s.id), similar(s)]);
  const today = todayISO();
  const nd = daysUntil(s.next_air_date);
  const bg = img(s.backdrop_path, "w1280");
  const poster = img(s.poster_path, "w500");
  const userPct = s.user_count >= 5 && s.user_avg != null ? Math.round(s.user_avg * 10) : null;
  const eps = s.current_season ?? [];
  const epSeason = s.next_ep?.season ?? s.last_ep?.season;

  const jsonLd = {
    "@context": "https://schema.org", "@type": "TVSeries", name: s.name, alternateName: s.original_name ?? undefined,
    description: s.overview ?? undefined, image: poster ?? undefined, startDate: s.first_air_date ?? undefined,
    numberOfSeasons: s.seasons ?? undefined, genre: s.genres, url: `${SITE_URL}${showHref(s)}`,
    actor: s.cast.slice(0, 5).map((c) => ({ "@type": "Person", name: c.name })),
    aggregateRating: s.imdb_rating ? { "@type": "AggregateRating", ratingValue: s.imdb_rating, bestRating: 10, ratingCount: s.tmdb_votes || 1 } : undefined,
  };

  return (
    <div className="bento">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="dhero w4">
        <Fallback id={s.id} />
        {bg && <img className="bd" src={bg} alt="" fetchPriority="high" />}
        {poster && <img className="dposter" src={poster} alt={`Plagát: ${s.name}`} />}
        <div>
          <h1>{s.name}</h1>
          {s.tagline && <p className="tag">{s.tagline}</p>}
          <p className="meta">
            {[s.year, s.genres.join(", "), s.seasons ? `${s.seasons} ${plural(s.seasons, "sezóna", "sezóny", "sezón")}` : null,
              s.status ? STATUS[s.status] ?? s.status : null].filter(Boolean).join(" · ")}
          </p>
          {s.original_name && s.original_name !== s.name && <p className="meta">Pôvodný názov: {s.original_name}</p>}
        </div>
      </section>

      <div className="tile stat">
        <span className="lbl">Priemer</span>
        <span className="rv" style={{ color: tone(s.score) }}>{s.score != null ? `${s.score}%` : "–"}</span>
        <span className="rs">zo všetkých zdrojov</span>
      </div>
      <div className="tile stat">
        <span className="lbl">IMDb</span>
        <span className="rv">{s.imdb_rating?.toFixed(1) ?? "–"}</span>
        <span className="rs">{s.imdb_id ? <a href={`https://www.imdb.com/title/${s.imdb_id}/`} target="_blank" rel="noopener">z 10 · otvoriť IMDb</a> : "z 10"}</span>
      </div>
      <div className="tile stat">
        <span className="lbl">Rotten Tomatoes</span>
        <span className="rv">{s.rt_rating != null ? `${s.rt_rating}%` : "–"}</span>
        <span className="rs">kritici</span>
      </div>
      <div className="tile stat">
        <span className="lbl">TMDB</span>
        <span className="rv">{s.tmdb_rating?.toFixed(1) ?? "–"}</span>
        <span className="rs">{s.tmdb_votes} hlasov</span>
      </div>

      <div className="tile w3">
        <p className="prose">{s.overview ?? "Popis zatiaľ nie je k dispozícii."}</p>
        {s.next_ep && nd != null && nd >= 0 && (
          <p><b>Ďalšia epizóda:</b> {epCode(s.next_ep.season, s.next_ep.episode)}{s.next_ep.name ? ` · ${s.next_ep.name}` : ""} · {fmtDate(s.next_air_date)} ({rel(nd)})</p>
        )}
        <FollowButton showId={s.id} name={s.name} initial={fol.has(s.id)} variant="full" nextLabel={nextLabel(s)} />
        {s.creators.length > 0 && <p className="muted">Tvorcovia: {s.creators.join(", ")}</p>}
      </div>

      <div className="tile rate">
        <span className="lbl">Kukátko</span>
        <span className="rv">{userPct != null ? `${userPct}%` : "–"}</span>
        <span className="rs">{s.user_count} {plural(s.user_count, "hodnotenie", "hodnotenia", "hodnotení")}{userPct == null ? " (ukáže sa od 5)" : ""}</span>
        <span className="lbl" style={{ marginTop: 6 }}>Tvoje hodnotenie</span>
        <Rate showId={s.id} initial={mine} />
      </div>

      <div className="tile w2">
        <span className="lbl"><span>Kde pozerať</span><span>Slovensko</span></span>
        {s.providers.length ? s.providers.map((p) => {
          const st = platformStyle(p.name);
          const href = AFFILIATE[p.name] ?? s.watch_link ?? "#";
          return (
            <a key={p.id} className="wl" href={href} target="_blank" rel="noopener sponsored">
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {p.logo_path ? <img src={img(p.logo_path, "w185")!} alt="" /> : <span className="pl" style={{ background: st.color }}>{st.short}</span>}
                {p.name}
              </span>
              <small>{p.type === "flatrate" ? "v predplatnom" : p.type === "free" ? "zadarmo" : "s reklamami"} →</small>
            </a>
          );
        }) : <p className="muted">Momentálne nie je dostupný na žiadnej streamovacej službe v SR.</p>}
        <small className="muted">Dostupnosť od JustWatch, aktualizované denne.</small>
      </div>

      <div className="tile w2">
        <span className="lbl"><span>Epizódy{epSeason ? ` · ${epSeason}. sezóna` : ""}</span></span>
        {eps.length ? eps.map((e) => (
          <div key={e.episode} className={`ep${e.air_date && e.air_date >= today ? " up" : ""}`}>
            <span className="mono">E{String(e.episode).padStart(2, "0")}</span>
            <span>{e.name}</span>
            <span className="mono">{e.air_date ? fmtDate(e.air_date) : "–"}</span>
          </div>
        )) : <p className="muted">{s.status === "Ended" || s.status === "Canceled" ? "Seriál je ukončený, všetky epizódy sú vonku." : "Nová sezóna zatiaľ nie je ohlásená."}</p>}
      </div>

      {s.trailer_key && (
        <div className="tile w2">
          <span className="lbl">Trailer</span>
          <a className="trailer" href={`https://www.youtube.com/watch?v=${s.trailer_key}`} target="_blank" rel="noopener">
            <img src={`https://i.ytimg.com/vi/${s.trailer_key}/hqdefault.jpg`} alt={`Trailer: ${s.name}`} loading="lazy" />
            <span><i><Play /></i></span>
          </a>
        </div>
      )}

      {s.cast.length > 0 && (
        <div className={`tile ${s.trailer_key ? "w2" : "w4"}`}>
          <span className="lbl">Hrajú</span>
          <div className="cast">
            {s.cast.map((c) => (
              <div key={c.name} className="person">
                {c.profile_path
                  ? <img className="av" src={img(c.profile_path, "w185")!} alt="" loading="lazy" />
                  : <div className="av" style={{ background: "var(--tile2)", color: "var(--muted)" }}>{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>}
                {c.name}{c.character && <small>{c.character}</small>}
              </div>
            ))}
          </div>
        </div>
      )}

      <AdSlot />

      {sim.length > 0 && (
        <div className="tile w4">
          <div className="cathead"><h2>Podobné seriály</h2><Link className="btn soft" href="/katalog">Katalóg</Link></div>
          <div className="posters">{sim.map((x) => <Poster key={x.id} s={x} followed={fol.has(x.id)} />)}</div>
        </div>
      )}
    </div>
  );
}
