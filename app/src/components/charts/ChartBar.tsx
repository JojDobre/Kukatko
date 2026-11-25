"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "../I18n";
import { Sliders, X } from "../icons";

export type ChartState = { kind: "tv" | "movie" | null; providers: number[]; genre: string | null; period: string; size: number };
type Prov = { id: number; name: string; logo: string | null; color: string; short: string };

const DECADES = [2010, 2000, 1990, 1980];

function query(s: ChartState) {
  const q = new URLSearchParams();
  if (s.kind) q.set("k", s.kind);
  if (s.providers.length) q.set("p", s.providers.join("."));
  if (s.genre) q.set("g", s.genre);
  if (s.period !== "all") q.set("y", s.period);
  if (s.size !== 100) q.set("n", String(s.size));
  return q.size ? `?${q}` : "";
}

/** Detail rebríčka: ikona filtra, typ (len kde dáva zmysel) a platformy ako logá. */
export default function ChartBar({ base, state, flags, provs, genres, locked }: {
  base: string; state: ChartState; flags: { kind: boolean; period: boolean; size: boolean };
  provs: Prov[]; genres: { ids: number[]; name: string }[]; locked: number | null;
}) {
  const { d, fmt } = useI18n();
  const c = d.charts;
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(state);
  useEffect(() => setDraft(state), [JSON.stringify(state)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);

  const go = (s: ChartState) => start(() => router.push(base + query(s), { scroll: false }));
  const year = new Date().getFullYear();
  const periodLabel = (p: string) => p === "all" ? c.periodAll : p === "year" ? fmt(c.periodYear, { y: year }) : p === "5y" ? c.period5 : `${p} – ${Number(p) + 9}`;
  const count = (state.genre ? 1 : 0) + (state.period !== "all" ? 1 : 0) + (state.size !== 100 ? 1 : 0);
  const chip = <T,>(cur: T, val: T, label: string, set: (v: T) => void) => (
    <button key={String(val)} className={`qchip${cur === val ? " on" : ""}`} aria-pressed={cur === val} onClick={() => set(val)}>{label}</button>
  );

  return (
    <>
      <div className="qbar">
        <button className="ibtn" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={c.filtersTitle}><Sliders />{count > 0 && <i>{count}</i>}</button>
        {flags.kind && (
          <>
            <span className="qsep" aria-hidden="true" />
            {chip(state.kind, null, c.all, () => go({ ...state, kind: null }))}
            {chip(state.kind, "tv" as const, c.tvs, () => go({ ...state, kind: "tv" }))}
            {chip(state.kind, "movie" as const, c.movies, () => go({ ...state, kind: "movie" }))}
          </>
        )}
        {state.genre && <button className="qchip on" onClick={() => go({ ...state, genre: null })}>{genres.find((g) => g.ids.join(".") === state.genre)?.name ?? c.genre}<X /></button>}
        {state.period !== "all" && <button className="qchip on" onClick={() => go({ ...state, period: "all" })}>{periodLabel(state.period)}<X /></button>}
      </div>
      <div className="plogos" role="group" aria-label={d.catalog.platforms}>
        <button className={`qchip${state.providers.length === 0 ? " on" : ""}`} onClick={() => go({ ...state, providers: locked ? [locked] : [] })}>{c.platformsAllShort}</button>
        {provs.map((p) => {
          const on = state.providers.includes(p.id);
          return (
            <button key={p.id} className="plogo" aria-pressed={on} aria-label={p.name} title={p.name} disabled={locked === p.id}
              onClick={() => go({ ...state, providers: on ? state.providers.filter((x) => x !== p.id) : [...state.providers, p.id] })}>
              {p.logo ? <img src={p.logo} alt="" /> : <span style={{ background: p.color }}>{p.short}</span>}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={c.filtersTitle} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="sheet sheet-sm">
            <div className="sheet-head"><h2>{c.filtersTitle}</h2><button className="round sm" onClick={() => setOpen(false)} aria-label={d.common.close}><X /></button></div>
            <div className="sheet-body">
              <section><h3>{c.genre}</h3>
                <div className="fopts">
                  {chip(draft.genre, null as string | null, c.anyGenre, (v) => setDraft({ ...draft, genre: v }))}
                  {genres.map((g) => chip(draft.genre, g.ids.join(".") as string | null, g.name, (v) => setDraft({ ...draft, genre: v })))}
                </div></section>
              {flags.period && (
                <section><h3>{c.period}</h3>
                  <div className="fopts">{["all", "year", "5y", ...DECADES.map(String)].map((p) => chip(draft.period, p, periodLabel(p), (v) => setDraft({ ...draft, period: v })))}</div></section>
              )}
              {flags.size && (
                <section><h3>{c.size}</h3>
                  <div className="fopts">{[10, 50, 100].map((n) => chip(draft.size, n, `Top ${n}`, (v) => setDraft({ ...draft, size: v })))}</div></section>
              )}
            </div>
            <div className="sheet-foot">
              <button className="btn soft" onClick={() => setDraft({ ...draft, genre: null, period: "all", size: 100 })}>{c.reset}</button>
              <button className="btn" onClick={() => { setOpen(false); go(draft); }}>{c.show}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
