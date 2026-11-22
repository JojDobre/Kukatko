"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "./I18n";
import { toast } from "./toast";
import { Bookmark, Check, EyeOff } from "./icons";

async function post(path: string, body: object) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return !!r?.ok;
}

/** Chcem vidieť, Nezaujíma ma a (pri filme) Videl som. */
export default function TitleActions({ titleId, kind, want, hidden, seen }: { titleId: number; kind: "tv" | "movie"; want: boolean; hidden: boolean; seen: boolean }) {
  const { d } = useI18n();
  const [w, setW] = useState(want);
  const [h, setH] = useState(hidden);
  const [s, setS] = useState(seen);
  const [, start] = useTransition();
  const router = useRouter();
  const refresh = () => start(() => router.refresh());

  async function toggleWant() {
    const on = !w; setW(on);
    if (!(await post("/api/want", { titleId, on }))) { setW(!on); return toast(d.follow.saveError); }
    toast(on ? `${d.want.added}. ${d.want.hint}` : d.want.removed); refresh();
  }
  async function toggleHidden() {
    const on = !h; setH(on);
    if (!(await post("/api/hidden", { titleId, on }))) { setH(!on); return toast(d.follow.saveError); }
    toast(on ? d.hidden.done : d.hidden.undo); refresh();
  }
  async function toggleSeen() {
    const on = !s; setS(on);
    if (!(await post("/api/watched", { titleId, season: 0, on }))) { setS(!on); return toast(d.follow.saveError); }
    refresh();
  }

  return (
    <div className="actions">
      <button className={`btn soft${w ? " on" : ""}`} aria-pressed={w} onClick={toggleWant}><Bookmark on={w} />{w ? d.want.on : d.want.add}</button>
      {kind === "movie" && <button className={`btn soft${s ? " on" : ""}`} aria-pressed={s} onClick={toggleSeen}><Check />{s ? d.stats.markedMovie : d.stats.markMovie}</button>}
      <button className={`btn soft${h ? " on" : ""}`} aria-pressed={h} onClick={toggleHidden}><EyeOff />{h ? d.hidden.undo : d.hidden.hide}</button>
    </div>
  );
}

/** Malé tlačidlo na vrátenie skrytého titulu (v zozname skrytých). */
export function Unhide({ titleId }: { titleId: number }) {
  const { d } = useI18n();
  const router = useRouter();
  const [, start] = useTransition();
  return <button className="link" onClick={async () => { await post("/api/hidden", { titleId, on: false }); start(() => router.refresh()); }}>{d.hidden.undo}</button>;
}
