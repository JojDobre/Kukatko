"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Chevron } from "./icons";
import { platformStyle } from "@/lib/platforms";
import { useI18n } from "./I18n";

type Props = {
  kind: "tv" | "movie";
  sort: string;
  sorts: string[];
  providers: { id: number; name: string; count: number }[];
  selected: number[];
  region: string;
  genres: { id: number; name: string; count: number }[];
  genre: number | null;
};

export default function Filters({ kind, sort, sorts, providers, selected, region, genres, genre }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [plats, setPlats] = useState<number[]>(selected);
  const [, start] = useTransition();
  const router = useRouter();
  const params = useSearchParams();
  const box = useRef<HTMLDivElement>(null);
  const { d, href, fmt } = useI18n();

  useEffect(() => setPlats(selected), [selected.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  function go(next: Record<string, string | null>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) v ? q.set(k, v) : q.delete(k);
    q.delete("page");
    start(() => router.push(`${href("/catalog")}${q.size ? "?" + q.toString() : ""}`, { scroll: false }));
  }
  function savePlats(next: number[]) {
    setPlats(next);
    // Výber platforiem si pamätáme v cookie (pre každý región zvlášť), platí aj pre domovskú stránku.
    document.cookie = `plats_${region}=${next.join(".")}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  const item = (key: string, on: boolean, content: React.ReactNode, onClick: () => void) => (
    <button key={key} role="menuitemcheckbox" aria-checked={on} onClick={onClick}>
      <span>{content}</span><span className="ck">{on && <Check />}</span>
    </button>
  );
  const dd = (id: string, label: string, value: string, items: React.ReactNode) => (
    <div className="dd">
      <button className="ddb" aria-haspopup="menu" aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>
        <small>{label}</small>{value}<Chevron />
      </button>
      {open === id && <div className="ddm" role="menu">{items}</div>}
    </div>
  );
  const sortLabel = (k: string) => (d.catalog.sorts as Record<string, string>)[k] ?? k;

  return (
    <div className="filters" ref={box}>
      <div className="seg" role="group" aria-label={`${d.common.tvs} / ${d.common.movies}`}>
        <button aria-pressed={kind === "tv"} onClick={() => go({ kind: null, genre: null, sort: sort === "next" ? null : params.get("sort") })}>{d.common.tvs}</button>
        <button aria-pressed={kind === "movie"} onClick={() => go({ kind: "movie", genre: null, sort: sort === "next" ? null : params.get("sort") })}>{d.common.movies}</button>
      </div>
      {dd("sort", d.catalog.sort, sortLabel(sort), sorts.map((k) =>
        item(k, k === sort, sortLabel(k), () => { setOpen(null); go({ sort: k === "score" ? null : k }); })))}
      {dd("plat", d.catalog.platforms, plats.length ? fmt(d.catalog.selected, { n: plats.length }) : d.common.all, <>
        {providers.map((p) => item(String(p.id), plats.includes(p.id),
          <><span className="pdot" style={{ background: platformStyle(p.name).color }} />{p.name}<span className="cnt">{p.count}</span></>,
          () => savePlats(plats.includes(p.id) ? plats.filter((x) => x !== p.id) : [...plats, p.id])))}
        {plats.length > 0 && <button className="clr" onClick={() => savePlats([])}>{d.catalog.clear}</button>}
      </>)}
      {dd("genre", d.catalog.genre, genres.find((g) => g.id === genre)?.name ?? d.common.all, <>
        {item("", !genre, d.common.all, () => { setOpen(null); go({ genre: null }); })}
        {genres.map((g) => item(String(g.id), g.id === genre, <>{g.name}<span className="cnt">{g.count}</span></>,
          () => { setOpen(null); go({ genre: String(g.id) }); }))}
      </>)}
    </div>
  );
}
