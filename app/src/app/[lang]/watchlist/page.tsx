import type { Metadata } from "next";
import Link from "next/link";
import { deviceId } from "@/lib/device";
import { cardsByIds, followed, recommended } from "@/lib/queries";
import { inProgress } from "@/lib/extra";
import { hiddenList, wantList } from "@/lib/features";
import { Unhide } from "@/components/TitleActions";
import { daysUntil, epCode, fmtDate, rel, todayISO } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { page, titleHref, type LangParams } from "@/lib/page";
import Poster, { Thumb } from "@/components/Poster";
import QuickLinks from "@/components/QuickLinks";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { d } = await page(params);
  return { title: d.watchlist.metaTitle, robots: { index: false } };
}

export default async function Watchlist({ params }: { params: LangParams }) {
  const { lang, d, ctx, h } = await page(params);
  const dev = await deviceId();
  const today = todayISO();
  const [mine, rec, prog, want, hid] = await Promise.all([
    dev ? followed(ctx, dev) : [], recommended(ctx, dev, 12), dev ? inProgress(dev, lang, today) : [],
    dev ? wantList(ctx, dev) : [], dev ? hiddenList(ctx, dev) : [],
  ]);
  const tv = mine.filter((s) => s.kind === "tv");
  const movies = mine.filter((s) => s.kind === "movie");
  const up = tv.filter((s) => (daysUntil(s.next_air_date) ?? -1) >= 0);
  const rest = tv.filter((s) => !up.includes(s));
  const ids = new Set(mine.map((s) => s.id));
  const progCards = await cardsByIds(ctx, prog.map((p) => p.title_id));
  const progress = prog.map((p) => ({ ...p, t: progCards.find((s) => s.id === p.title_id)! })).filter((p) => p.t && p.watched < p.aired);

  return (
    <div className="bento">
      <QuickLinks lang={lang} />
      {progress.length > 0 && (
        <div className="tile w4">
          <div className="lbl"><span>{d.watched.inProgress}</span><span>{progress.length}</span></div>
          <div className="prog-grid">
            {progress.map((p) => (
              <Link key={p.title_id} href={p.next_season != null ? `${titleHref(lang, p.t)}/season/${p.next_season}/episode/${p.next_episode}` : titleHref(lang, p.t)} className="wrow">
                <Thumb s={p.t} />
                <span>
                  <b>{p.t.name}</b>
                  <small>{p.next_season != null ? fmt(d.watched.continueWith, { ep: epCode(p.next_season, p.next_episode!) }) : d.watched.allWatched}{p.next_name ? ` · ${p.next_name}` : ""}</small>
                  <span className="bar"><i style={{ width: `${(p.watched / p.aired) * 100}%` }} /></span>
                </span>
                <span className="chipday">{p.watched}/{p.aired}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="tile w2">
        <div className="lbl"><span>{d.watchlist.upcoming}</span><span>{up.length}</span></div>
        {up.length ? up.map((s) => {
          const n = daysUntil(s.next_air_date)!;
          return (
            <Link key={s.id} href={titleHref(lang, s)} className="wrow">
              <Thumb s={s} />
              <span><b>{s.name}</b><small>{epCode(s.next_ep!.season, s.next_ep!.episode)} · {fmtDate(s.next_air_date, lang)} · {s.providers[0]?.name ?? ""}</small></span>
              <span className={`chipday${n <= 1 ? " hot" : ""}`}>{rel(n, lang)}</span>
            </Link>
          );
        }) : <p className="muted">{d.watchlist.empty}</p>}
        <Link href={h("/profile")} className="btn soft">{d.watchlist.setup}</Link>
      </div>
      <div className="tile w2">
        <div className="lbl"><span>{d.watchlist.waitingSeason}</span><span>{rest.length}</span></div>
        {rest.length ? <div className="posters">{rest.map((s) => <Poster key={s.id} s={s} lang={lang} followed />)}</div>
          : <p className="muted">{d.watchlist.allHaveNext}</p>}
      </div>
      {movies.length > 0 && (
        <div className="tile w4">
          <div className="lbl"><span>{d.watchlist.movies}</span><span>{movies.length}</span></div>
          <div className="posters">{movies.map((s) => <Poster key={s.id} s={s} lang={lang} followed note={s.providers.length ? undefined : <span>{d.watchlist.notStreaming}</span>} />)}</div>
        </div>
      )}
      <div className="tile w4">
        <div className="lbl"><span>{d.want.list}</span><span>{want.length}</span></div>
        {want.length ? <div className="posters">{want.map((s) => <Poster key={s.id} s={s} lang={lang} followed={ids.has(s.id)}
          note={s.providers.length ? undefined : <span>{d.watchlist.notStreaming}</span>} />)}</div> : <p className="muted">{d.want.empty}</p>}
        {want.length > 0 && <small className="muted">{d.want.hint}</small>}
      </div>
      <div className="tile w4">
        <div className="lbl"><span>{mine.length ? d.watchlist.mightLike : d.watchlist.startWith}</span></div>
        <div className="posters">{rec.map((s) => <Poster key={s.id} s={s} lang={lang} followed={ids.has(s.id)} />)}</div>
      </div>
      {hid.length > 0 && (
        <details className="tile w4">
          <summary className="lbl" style={{ cursor: "pointer" }}><span>{d.hidden.list}</span><span>{hid.length}</span></summary>
          {hid.map((s) => (
            <div key={s.id} className="wrow">
              <Thumb s={s} />
              <span><Link href={titleHref(lang, s)}><b>{s.name}</b></Link><small>{s.year}</small></span>
              <Unhide titleId={s.id} />
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
