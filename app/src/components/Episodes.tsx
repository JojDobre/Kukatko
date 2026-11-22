"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check } from "./icons";
import { useI18n } from "./I18n";
import { toast } from "./toast";

export type EpRow = { season: number; episode: number; name: string | null; air_date: string | null; watched: boolean; still_path: string | null; score: number | null };

const code = (s: number, e: number) => `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}`;
const tone = (v: number) => (v >= 80 ? "var(--good)" : v >= 65 ? "var(--mid)" : "var(--low)");

/** Zoznam epizód so sezónami, obrázkami, skóre a odškrtávaním pozretých. */
export default function Episodes({ titleId, base, eps, startSeason, today, dateFmt }: {
  titleId: number; base: string; eps: EpRow[]; startSeason: number; today: string; dateFmt: Record<string, string>;
}) {
  const { d, fmt } = useI18n();
  const w = d.watched;
  const [season, setSeason] = useState(startSeason);
  const [state, setState] = useState(() => new Set(eps.filter((e) => e.watched).map((e) => `${e.season}:${e.episode}`)));
  const [, start] = useTransition();
  const router = useRouter();
  const seasons = useMemo(() => [...new Set(eps.map((e) => e.season))].sort((a, b) => a - b), [eps]);
  const list = eps.filter((e) => e.season === season);
  const aired = (e: EpRow) => !!e.air_date && e.air_date <= today;
  const airedAll = eps.filter(aired);
  const done = airedAll.filter((e) => state.has(`${e.season}:${e.episode}`)).length;
  const next = airedAll.find((e) => !state.has(`${e.season}:${e.episode}`));
  const seasonAired = list.filter(aired);
  const seasonDone = seasonAired.length > 0 && seasonAired.every((e) => state.has(`${e.season}:${e.episode}`));

  async function send(body: object, apply: (s: Set<string>) => void) {
    const prev = new Set(state);
    const nextState = new Set(state);
    apply(nextState);
    setState(nextState);
    const r = await fetch("/api/watched", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titleId, ...body }) }).catch(() => null);
    if (!r?.ok) { setState(prev); toast(d.follow.saveError); return; }
    start(() => router.refresh());
  }
  const toggle = (e: EpRow) => {
    const k = `${e.season}:${e.episode}`;
    const on = !state.has(k);
    send({ season: e.season, episode: e.episode, on }, (s) => (on ? s.add(k) : s.delete(k)));
  };
  const toggleSeason = () => {
    const on = !seasonDone;
    send({ season, on }, (s) => seasonAired.forEach((e) => (on ? s.add(`${e.season}:${e.episode}`) : s.delete(`${e.season}:${e.episode}`))));
  };

  return (
    <>
      {seasons.length > 1 && (
        <div className="seg scroll" role="tablist">
          {seasons.map((s) => <button key={s} role="tab" aria-selected={s === season} aria-pressed={s === season} onClick={() => setSeason(s)}>{s}</button>)}
        </div>
      )}
      {airedAll.length > 0 && done > 0 && (
        <div className="progress">
          <div className="bar"><i style={{ width: `${(done / airedAll.length) * 100}%` }} /></div>
          <small className="muted">{fmt(w.progress, { w: done, t: airedAll.length })} · {next ? fmt(w.continueWith, { ep: code(next.season, next.episode) }) : w.allWatched}</small>
        </div>
      )}
      <div className="eplist">
        {list.map((e) => {
          const k = `${e.season}:${e.episode}`;
          const on = state.has(k);
          const up = !aired(e);
          const href = `${base}/season/${e.season}/episode/${e.episode}`;
          return (
            <div key={k} className={`eprow${up ? " up" : ""}${on ? " seen" : ""}`}>
              <Link href={href} className="epthumb" aria-hidden="true" tabIndex={-1}>
                {e.still_path ? <img src={`https://image.tmdb.org/t/p/w185${e.still_path}`} alt="" loading="lazy" /> : <span className="mono">{e.episode}</span>}
              </Link>
              <Link href={href} className="epname">
                <span className="eptitle"><span className="mono muted">E{String(e.episode).padStart(2, "0")}</span> {e.name ?? `${d.title.episodes} ${e.episode}`}</span>
                <small className="mono">{e.air_date ? dateFmt[e.air_date] ?? e.air_date : "–"}{up ? ` · ${w.notAired}` : ""}</small>
              </Link>
              {e.score != null && <span className="epscore mono" style={{ color: tone(e.score) }}>{e.score}</span>}
              {!up
                ? <button className="epck" role="checkbox" aria-checked={on} aria-label={`${w.mark}: ${code(e.season, e.episode)}`} onClick={() => toggle(e)}>{on && <Check />}</button>
                : <span className="epck ghost" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
      {seasonAired.length > 0 && <button className="btn soft" onClick={toggleSeason}>{seasonDone ? w.unmarkSeason : w.markSeason}</button>}
    </>
  );
}
