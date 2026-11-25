"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "../I18n";
import { toast } from "../toast";
import { Check } from "../icons";

/** Domov – „Pozreté“ pri ďalšej epizóde: označí ju a obnoví blok (posunie sa na ďalšiu). */
export default function MarkWatched({ titleId, season, episode }: { titleId: number; season: number; episode: number }) {
  const { d } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  async function click() {
    setBusy(true);
    const r = await fetch("/api/watched", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titleId, season, episode, on: true }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return toast(d.follow.saveError);
    start(() => router.refresh());
  }
  return <button className="btn accent wide" onClick={click} disabled={busy}><Check />{d.home.watched}</button>;
}
