"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Chevron } from "./icons";
import { platformStyle } from "@/lib/platforms";

type Props = {
  sorts: { key: string; label: string }[];
  sort: string;
  providers: { id: number; name: string; count: number }[];
  selected: number[];
  genres: { genre: string; count: number }[];
  genre: string | null;
};

export default function Filters({ sorts, sort, providers, selected, genres, genre }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [plats, setPlats] = useState<number[]>(selected);
  const [, start] = useTransition();
  const router = useRouter();
  const params = useSearchParams();
  const box = useRef<HTMLDivElement>(null);

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
    q.delete("strana");
    start(() => router.push(`/katalog${q.size ? "?" + q.toString() : ""}`, { scroll: false }));
  }

  function togglePlat(id: number) {
    const next = plats.includes(id) ? plats.filter((x) => x !== id) : [...plats, id];
    setPlats(next);
    savePlats(next);
  }
  function savePlats(next: number[]) {
    // Výber platforiem si pamätáme v cookie, platí aj pre domovskú stránku.
    document.cookie = `plats=${next.join(".")}; path=/; max-age=31536000; samesite=lax`;
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

  return (
    <div className="filters" ref={box}>
      {dd("sort", "Zoradiť", sorts.find((s) => s.key === sort)?.label ?? "", sorts.map((s) =>
        item(s.key, s.key === sort, s.label, () => { setOpen(null); go({ zoradit: s.key === "score" ? null : s.key }); })))}
      {dd("plat", "Platformy", plats.length ? `${plats.length} vybrané` : "Všetky", <>
        {providers.map((p) => item(String(p.id), plats.includes(p.id),
          <><span className="pdot" style={{ background: platformStyle(p.name).color }} />{p.name}<span className="cnt">{p.count}</span></>,
          () => togglePlat(p.id)))}
        {plats.length > 0 && <button className="clr" onClick={() => { setPlats([]); savePlats([]); }}>Zrušiť výber</button>}
      </>)}
      {dd("genre", "Žáner", genre ?? "Všetky", <>
        {item("", !genre, "Všetky", () => { setOpen(null); go({ zaner: null }); })}
        {genres.map((g) => item(g.genre, g.genre === genre, <>{g.genre}<span className="cnt">{g.count}</span></>,
          () => { setOpen(null); go({ zaner: g.genre }); }))}
      </>)}
    </div>
  );
}
