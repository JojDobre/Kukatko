"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { platformStyle } from "@/lib/platforms";
import { useI18n } from "./I18n";
import { Sliders, X } from "./icons";

export type FilterState = {
  kind: "all" | "tv" | "movie"; sort: string; genre: string | null; year: number | null;
  runtime: "short" | "medium" | "long" | null; score: number | null; lang: string | null;
};

type Props = {
  state: FilterState;
  sorts: string[];
  providers: { id: number; name: string; count: number; logo_path: string | null }[];
  selected: number[];
  region: string;
  genres: { ids: number[]; name: string; count: number }[];
  languages: { code: string; count: number }[];
};

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970];

/** Katalóg: prepínač typu, tlačidlo „Filtre“ s panelom a aktívne filtre ako čipy. */
export default function Filters({ state, sorts, providers, selected, region, genres, languages }: Props) {
  const { d, href, fmt, lang } = useI18n();
  const f = d.filters;
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(state);
  const [plats, setPlats] = useState(selected);

  useEffect(() => { setDraft(state); setPlats(selected); }, [JSON.stringify(state), selected.join(".")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);

  const langName = (code: string) => { try { return new Intl.DisplayNames([lang], { type: "language" }).of(code) ?? code; } catch { return code; } };
  const sortLabel = (k: string) => (d.catalog.sorts as Record<string, string>)[k] ?? k;
  const rt = (k: string) => (k === "movie" ? f.runtimeMovie : f.runtimeTv);
  const decadeLabel = (y: number) => (y === 1970 ? `< 1980` : `${y} – ${y + 9}`);

  function url(s: FilterState) {
    const q = new URLSearchParams();
    if (s.kind !== "all") q.set("kind", s.kind);
    if (s.sort !== "score") q.set("sort", s.sort);
    if (s.genre) q.set("genre", s.genre);
    if (s.year) q.set("year", String(s.year));
    if (s.runtime) q.set("runtime", s.runtime);
    if (s.score) q.set("score", String(s.score));
    if (s.lang) q.set("lang", s.lang);
    return `${href("/catalog")}${q.size ? "?" + q : ""}`;
  }
  function savePlats(next: number[]) {
    // Platformy pamätáme v cookie (platia aj na domovskej stránke) a na serveri (upozornenia).
    document.cookie = `plats_${region}=${next.join(".")}; path=/; max-age=31536000; samesite=lax`;
    fetch("/api/platforms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ region, ids: next }) }).catch(() => {});
  }
  function go(s: FilterState, nextPlats = plats) {
    if (nextPlats.join(".") !== selected.join(".")) savePlats(nextPlats);
    start(() => { router.push(url(s), { scroll: false }); router.refresh(); });
  }
  function apply() { setOpen(false); go(draft, plats); }

  // Aktívne filtre zobrazené ako čipy (dajú sa zrušiť jedným ťuknutím).
  const chips: { label: string; clear: () => void }[] = [];
  if (state.sort !== "score") chips.push({ label: sortLabel(state.sort), clear: () => go({ ...state, sort: "score" }) });
  for (const id of selected) {
    const p = providers.find((x) => x.id === id);
    if (p) chips.push({ label: p.name, clear: () => { const n = selected.filter((x) => x !== id); setPlats(n); go(state, n); } });
  }
  if (state.genre) chips.push({ label: genres.find((g) => g.ids.join(".") === state.genre)?.name ?? f.any, clear: () => go({ ...state, genre: null }) });
  if (state.year) chips.push({ label: decadeLabel(state.year), clear: () => go({ ...state, year: null }) });
  if (state.runtime) chips.push({ label: rt(state.kind)[state.runtime], clear: () => go({ ...state, runtime: null }) });
  if (state.score) chips.push({ label: fmt(f.scoreMin, { n: state.score }), clear: () => go({ ...state, score: null }) });
  if (state.lang) chips.push({ label: langName(state.lang), clear: () => go({ ...state, lang: null }) });
  const activeCount = chips.length;

  const opt = <T,>(cur: T, val: T, label: React.ReactNode, set: (v: T) => void) => (
    <button key={String(val)} className={`fchip${cur === val ? " on" : ""}`} aria-pressed={cur === val} onClick={() => set(val)}>{label}</button>
  );
  const kinds = [["all", d.common.everything], ["tv", d.common.tvs], ["movie", d.common.movies]] as const;

  return (
    <>
      <div className="fbar">
        <div className="seg" role="group" aria-label={f.kind}>
          {kinds.map(([k, l]) => (
            <button key={k} aria-pressed={state.kind === k}
              onClick={() => go({ ...state, kind: k, genre: null, runtime: null, sort: k !== "tv" && state.sort === "next" ? "score" : state.sort })}>{l}</button>
          ))}
        </div>
        <button className={`fbtn${activeCount ? " on" : ""}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Sliders />{f.button}{activeCount > 0 && <span className="fcount">{activeCount}</span>}
        </button>
      </div>
      {chips.length > 0 && (
        <div className="fchips">
          {chips.map((c) => <button key={c.label} className="achip" onClick={c.clear}>{c.label}<X /></button>)}
          <button className="link" onClick={() => { setPlats([]); go({ kind: state.kind, sort: "score", genre: null, year: null, runtime: null, score: null, lang: null }, []); }}>{f.reset}</button>
        </div>
      )}

      {open && (
        <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={f.title} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="sheet">
            <div className="sheet-head">
              <h2>{f.title}</h2>
              <button className="round sm" onClick={() => setOpen(false)} aria-label={d.common.close}><X /></button>
            </div>
            <div className="sheet-body">
              <section><h3>{d.catalog.sort}</h3>
                <div className="fopts">{sorts.filter((k) => !(draft.kind !== "tv" && k === "next")).map((k) => opt(draft.sort, k, sortLabel(k), (v) => setDraft({ ...draft, sort: v })))}</div></section>
              <section><h3>{d.catalog.platforms}</h3>
                <div className="fopts">
                  {providers.map((p) => {
                    const on = plats.includes(p.id);
                    return (
                      <button key={p.id} className={`fchip${on ? " on" : ""}`} aria-pressed={on} onClick={() => setPlats(on ? plats.filter((x) => x !== p.id) : [...plats, p.id])}>
                        {p.logo_path ? <img src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} alt="" /> : <span className="pdot" style={{ background: platformStyle(p.name).color }} />}
                        {p.name}
                      </button>
                    );
                  })}
                </div></section>
              <section><h3>{d.catalog.genre}</h3>
                <div className="fopts">{opt(draft.genre, null as string | null, f.any, (v) => setDraft({ ...draft, genre: v }))}
                  {genres.map((g) => opt(draft.genre, g.ids.join(".") as string | null, g.name, (v) => setDraft({ ...draft, genre: v })))}</div></section>
              <section><h3>{f.year}</h3>
                <div className="fopts">{opt(draft.year, null as number | null, f.any, (v) => setDraft({ ...draft, year: v }))}
                  {DECADES.map((y) => opt(draft.year, y as number | null, decadeLabel(y), (v) => setDraft({ ...draft, year: v })))}</div></section>
              <section><h3>{f.runtime}</h3>
                <div className="fopts">{opt(draft.runtime, null as FilterState["runtime"], f.any, (v) => setDraft({ ...draft, runtime: v }))}
                  {(["short", "medium", "long"] as const).map((r) => opt(draft.runtime, r as FilterState["runtime"], draft.kind === "all" ? `${f.runtimeMovie[r]} / ${f.runtimeTv[r]}` : rt(draft.kind)[r], (v) => setDraft({ ...draft, runtime: v })))}</div></section>
              <section><h3>{f.score}</h3>
                <div className="fopts">{opt(draft.score, null as number | null, f.any, (v) => setDraft({ ...draft, score: v }))}
                  {[60, 70, 80, 90].map((n) => opt(draft.score, n as number | null, fmt(f.scoreMin, { n }), (v) => setDraft({ ...draft, score: v })))}</div></section>
              {languages.length > 1 && (
                <section><h3>{f.language}</h3>
                  <div className="fopts">{opt(draft.lang, null as string | null, f.any, (v) => setDraft({ ...draft, lang: v }))}
                    {languages.map((l) => opt(draft.lang, l.code as string | null, langName(l.code), (v) => setDraft({ ...draft, lang: v })))}</div></section>
              )}
            </div>
            <div className="sheet-foot">
              <button className="btn soft" onClick={() => { setPlats([]); setDraft({ kind: draft.kind, sort: "score", genre: null, year: null, runtime: null, score: null, lang: null }); }}>{f.reset}</button>
              <button className="btn" onClick={apply}>{f.show}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
