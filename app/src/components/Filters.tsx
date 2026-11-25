"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { platformStyle } from "@/lib/platforms";
import { useI18n } from "./I18n";
import { Check, Sliders, X } from "./icons";
import { catalogQuery, type FilterState } from "@/lib/catalogUrl";

export type { FilterState };

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

const SortIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
  </svg>
);
export const GridIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>
);
export const ListIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
);

/** Prepínač mriežka / zoznam vedľa nadpisu katalógu. */
export function ViewToggle({ state }: { state: FilterState }) {
  const { d, href } = useI18n();
  const router = useRouter();
  const [, start] = useTransition();
  const set = (view: "grid" | "list") => {
    document.cookie = `catview=${view}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.push(`${href("/catalog")}${catalogQuery({ ...state, view })}`, { scroll: false }));
  };
  return (
    <div className="vtog" role="group" aria-label={d.catalog.list}>
      <button aria-pressed={state.view === "grid"} aria-label={d.catalog.grid} onClick={() => set("grid")}><GridIcon /></button>
      <button aria-pressed={state.view === "list"} aria-label={d.catalog.list} onClick={() => set("list")}><ListIcon /></button>
    </div>
  );
}

/** Katalóg: jeden rad – ikony Zoradiť a Filtre, typ a rýchle filtre ako čipy. */
export default function Filters({ state, sorts, providers, selected, region, genres, languages }: Props) {
  const { d, href, fmt, lang } = useI18n();
  const f = d.filters;
  const c = d.catalog;
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState<null | "filters" | "sort">(null);
  const [draft, setDraft] = useState(state);
  const [plats, setPlats] = useState(selected);

  useEffect(() => { setDraft(state); setPlats(selected); }, [JSON.stringify(state), selected.join(".")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);

  const langName = (code: string) => { try { return new Intl.DisplayNames([lang], { type: "language" }).of(code) ?? code; } catch { return code; } };
  const sortLabel = (k: string) => (c.sorts as Record<string, string>)[k] ?? k;
  const rt = (k: string) => (k === "movie" ? f.runtimeMovie : f.runtimeTv);
  const decadeLabel = (y: number) => (y === 1970 ? `< 1980` : `${y} – ${y + 9}`);

  function savePlats(next: number[]) {
    // Platformy pamätáme v cookie (platia aj na domovskej stránke) a na serveri (upozornenia).
    document.cookie = `plats_${region}=${next.join(".")}; path=/; max-age=31536000; samesite=lax`;
    fetch("/api/platforms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ region, ids: next }) }).catch(() => {});
  }
  function go(s: FilterState, nextPlats = plats) {
    if (nextPlats.join(".") !== selected.join(".")) savePlats(nextPlats);
    start(() => { router.push(`${href("/catalog")}${catalogQuery(s)}`, { scroll: false }); router.refresh(); });
  }
  function apply() { setOpen(null); go({ ...draft, all: draft.all && plats.length > 0 ? draft.all : false }, plats); }

  // Rýchle čipy: typ, moje platformy, hodnotenie, novinky a 3 najväčšie žánre.
  const quickGenres = [...genres].sort((a, b) => b.count - a.count).slice(0, 3);
  const quick: { label: string; on: boolean; toggle: () => void }[] = [
    { label: c.tvs, on: state.kind === "tv", toggle: () => go({ ...state, kind: state.kind === "tv" ? "all" : "tv", genre: null, runtime: null }) },
    { label: c.movies, on: state.kind === "movie", toggle: () => go({ ...state, kind: state.kind === "movie" ? "all" : "movie", genre: null, runtime: null, sort: state.sort === "next" ? "score" : state.sort }) },
  ];
  if (selected.length) quick.push({ label: c.mine, on: !state.all, toggle: () => go({ ...state, all: !state.all }) });
  quick.push({ label: fmt(f.scoreMin, { n: 80 }), on: state.score === 80, toggle: () => go({ ...state, score: state.score === 80 ? null : 80 }) });
  quick.push({ label: c.recent, on: state.year === 2020, toggle: () => go({ ...state, year: state.year === 2020 ? null : 2020 }) });
  for (const g of quickGenres) {
    const key = g.ids.join(".");
    quick.push({ label: g.name, on: state.genre === key, toggle: () => go({ ...state, genre: state.genre === key ? null : key }) });
  }
  // Ostatné aktívne filtre (z panelu), ktoré nie sú medzi rýchlymi čipmi – zrušia sa krížikom.
  const extra: { label: string; clear: () => void }[] = [];
  if (state.genre && !quickGenres.some((g) => g.ids.join(".") === state.genre)) extra.push({ label: genres.find((g) => g.ids.join(".") === state.genre)?.name ?? f.any, clear: () => go({ ...state, genre: null }) });
  if (state.year && state.year !== 2020) extra.push({ label: decadeLabel(state.year), clear: () => go({ ...state, year: null }) });
  if (state.score && state.score !== 80) extra.push({ label: fmt(f.scoreMin, { n: state.score }), clear: () => go({ ...state, score: null }) });
  if (state.runtime) extra.push({ label: rt(state.kind)[state.runtime], clear: () => go({ ...state, runtime: null }) });
  if (state.lang) extra.push({ label: langName(state.lang), clear: () => go({ ...state, lang: null }) });
  const activeCount = [state.genre, state.year, state.runtime, state.score, state.lang].filter(Boolean).length + (selected.length && !state.all ? 1 : 0);

  const opt = <T,>(cur: T, val: T, label: React.ReactNode, set: (v: T) => void) => (
    <button key={String(val)} className={`fchip${cur === val ? " on" : ""}`} aria-pressed={cur === val} onClick={() => set(val)}>{label}</button>
  );

  return (
    <>
      <div className="qbar">
        <button className="ibtn" onClick={() => setOpen("sort")} aria-haspopup="dialog" aria-label={`${c.sort}: ${sortLabel(state.sort)}`}
          data-on={state.sort !== "score" || undefined}><SortIcon /></button>
        <button className="ibtn" onClick={() => setOpen("filters")} aria-haspopup="dialog" aria-label={f.button}>
          <Sliders />{activeCount > 0 && <i>{activeCount}</i>}
        </button>
        <span className="qsep" aria-hidden="true" />
        {extra.map((x) => <button key={x.label} className="qchip on" onClick={x.clear}>{x.label}<X /></button>)}
        {quick.map((q) => <button key={q.label} className={`qchip${q.on ? " on" : ""}`} aria-pressed={q.on} onClick={q.toggle}>{q.label}</button>)}
      </div>

      {open === "sort" && (
        <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={c.sortBy} onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="sheet sheet-sm">
            <div className="sheet-head"><h2>{c.sortBy}</h2><button className="round sm" onClick={() => setOpen(null)} aria-label={d.common.close}><X /></button></div>
            <div className="sortlist">
              {sorts.filter((k) => !(state.kind !== "tv" && k === "next")).map((k) => (
                <button key={k} aria-pressed={state.sort === k} onClick={() => { setOpen(null); go({ ...state, sort: k }); }}>
                  {sortLabel(k)}{state.sort === k && <Check />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {open === "filters" && (
        <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={f.title} onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="sheet">
            <div className="sheet-head">
              <h2>{f.button}</h2>
              <button className="round sm" onClick={() => setOpen(null)} aria-label={d.common.close}><X /></button>
            </div>
            <div className="sheet-body">
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
              <button className="btn soft" onClick={() => { setPlats([]); setDraft({ ...draft, genre: null, year: null, runtime: null, score: null, lang: null }); }}>{f.reset}</button>
              <button className="btn" onClick={apply}>{f.show}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
