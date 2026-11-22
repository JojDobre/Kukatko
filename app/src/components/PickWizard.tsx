"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "./I18n";

const MOODS = ["relax", "tense", "think", "action", "romance", "scary", "family", "surprise"] as const;

/** Tri otázky a potom výsledok (adresa s parametrami, dá sa zdieľať). */
export default function PickWizard({ initial }: { initial: { mood?: string; kind?: string; time?: string } }) {
  const { d, href } = useI18n();
  const p = d.pick;
  const [mood, setMood] = useState(initial.mood ?? "");
  const [kind, setKind] = useState(initial.kind ?? "");
  const [time, setTime] = useState(initial.time ?? "");
  const router = useRouter();
  const ready = mood && kind && time;
  const go = () => router.push(href(`/pick?mood=${mood}&kind=${kind}&time=${time}&seed=${Math.floor(Math.random() * 1e6)}`), { scroll: false });
  const opt = (cur: string, set: (v: string) => void, v: string, label: string) => (
    <button key={v} className={`choice${cur === v ? " on" : ""}`} aria-pressed={cur === v} onClick={() => set(v)}>{label}</button>
  );
  return (
    <div className="wizard">
      <div className="q"><span className="lbl">1 · {p.mood}</span>
        <div className="choices">{MOODS.map((m) => opt(mood, setMood, m, p.moods[m]))}</div></div>
      <div className="q"><span className="lbl">2 · {p.kind}</span>
        <div className="choices">{opt(kind, setKind, "movie", d.common.movie)}{opt(kind, setKind, "tv", d.common.tv)}{opt(kind, setKind, "any", p.either)}</div></div>
      <div className="q"><span className="lbl">3 · {p.time}</span>
        <div className="choices">{(["short", "medium", "long"] as const).map((t) => opt(time, setTime, t, p.times[t]))}</div></div>
      <button className="btn big" disabled={!ready} onClick={go}>{p.cta}</button>
    </div>
  );
}
