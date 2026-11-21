import Link from "next/link";
import { deviceId } from "@/lib/device";
import { selectedPlats } from "@/lib/prefs";
import { followed, followedIds, topRated, upcoming } from "@/lib/queries";
import { daysUntil, epCode, fmtDate, img, plural, rel, todayISO, tone } from "@/lib/format";
import Poster, { Fallback, nextLabel, showHref } from "@/components/Poster";
import FollowButton from "@/components/FollowButton";
import AdSlot from "@/components/AdSlot";
import { Bell } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [dev, plats] = await Promise.all([deviceId(), selectedPlats()]);
  const [up, top, fol, mine] = await Promise.all([
    upcoming(12, plats),
    topRated(13, plats),
    followedIds(dev),
    dev ? followed(dev) : Promise.resolve([]),
  ]);

  if (!up.length && !top.length) {
    return (
      <section className="tile">
        <h1 style={{ fontSize: 26 }}>Katalóg sa pripravuje</h1>
        <p className="muted">Robot práve sťahuje seriály z TMDB. Prvá synchronizácia trvá zvyčajne pár minút.</p>
      </section>
    );
  }

  const f = up[0] ?? top[0];
  const fd = daysUntil(f.next_air_date);
  const bg = img(f.backdrop_path, "w1280") ?? img(f.poster_path, "w780");
  const week = up.slice(1).filter((s) => (daysUntil(s.next_air_date) ?? 99) <= 7).slice(0, 4);
  const best = top[0];

  return (
    <div className="bento">
      <div className="tile feature w2 h2">
        <Link href={showHref(f)} className="stretch" aria-label={f.name} />
        <Fallback id={f.id} />
        {bg && <img className="bgp" src={bg} alt="" fetchPriority="high" />}
        <span className="shade" />
        <span className="lbl"><span>{f.next_ep ? "Najbližšia premiéra" : "Najlepšie hodnotené"}</span><span>{f.providers[0]?.name ?? ""}</span></span>
        <h2>{f.name}</h2>
        {f.next_ep && <p>{epCode(f.next_ep.season, f.next_ep.episode)}{f.next_ep.name ? ` · ${f.next_ep.name}` : ""}</p>}
        {f.next_ep && fd != null && (
          <div className="when">
            <div><b>{fd === 0 ? "Dnes" : fd}</b><small>{fd === 0 ? "vychádza" : plural(fd, "deň", "dni", "dní")}</small></div>
            <div><b>{fmtDate(f.next_air_date)}</b><small>dátum vydania</small></div>
          </div>
        )}
        <div className="frow"><FollowButton showId={f.id} name={f.name} initial={fol.has(f.id)} variant="ghost" nextLabel={nextLabel(f)} /></div>
      </div>

      <div className="tile w2">
        <div className="lbl"><span>Tento týždeň</span><span>{fmtDate(todayISO())}</span></div>
        {week.length ? week.map((s) => {
          const d = daysUntil(s.next_air_date)!;
          return (
            <Link key={s.id} href={showHref(s)} className="wrow">
              {s.poster_path ? <img className="mini" src={img(s.poster_path, "w185")!} alt="" loading="lazy" /> : <span className="mini" style={{ position: "relative", overflow: "hidden" }}><Fallback id={s.id} /></span>}
              <span><b>{s.name}</b><small>{epCode(s.next_ep!.season, s.next_ep!.episode)} · {s.providers[0]?.name ?? ""}</small></span>
              <span className={`chipday${d <= 1 ? " hot" : ""}`}>{rel(d)}</span>
            </Link>
          );
        }) : <p className="muted">Na tvojich platformách tento týždeň nič nové nevychádza.</p>}
      </div>

      <Link href="/sledujem" className="tile click">
        <div className="lbl"><span>Sledujem</span><Bell size={16} /></div>
        <div className="big">{mine.length}<small> {plural(mine.length, "seriál", "seriály", "seriálov")}</small></div>
        <div className="stack">
          {mine.slice(0, 5).map((s) => s.poster_path
            ? <img key={s.id} src={img(s.poster_path, "w185")!} alt="" loading="lazy" />
            : <span key={s.id} style={{ position: "relative", overflow: "hidden" }}><Fallback id={s.id} /></span>)}
        </div>
      </Link>

      {best && (
        <Link href={showHref(best)} className="tile click">
          <div className="lbl"><span>Najlepšie hodnotený</span></div>
          <b style={{ fontSize: 17, lineHeight: 1.2 }}>{best.name}</b>
          <div className="ring" style={{ background: `conic-gradient(${tone(best.score)} ${best.score ?? 0}%, var(--tile2) 0)` }}><b>{best.score}</b></div>
        </Link>
      )}

      <AdSlot />

      <div className="tile w4">
        <div className="cathead">
          <h2>Najlepšie hodnotené{plats.length ? " na tvojich platformách" : ""}</h2>
          <Link href="/katalog" className="btn soft">Celý katalóg</Link>
        </div>
        <div className="posters">
          {top.slice(0, 12).map((s, i) => <Poster key={s.id} s={s} followed={fol.has(s.id)} priority={i < 4} />)}
        </div>
      </div>
    </div>
  );
}
