"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "./I18n";
import { toast } from "./toast";
import { Check } from "./icons";

/** Tlačidlo „Pozreté“ na stránke epizódy. */
export default function EpisodeWatched({ titleId, season, episode, initial, disabled }: { titleId: number; season: number; episode: number; initial: boolean; disabled: boolean }) {
  const { d } = useI18n();
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  const router = useRouter();
  async function click() {
    const next = !on;
    setOn(next);
    const r = await fetch("/api/watched", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titleId, season, episode, on: next }) }).catch(() => null);
    if (!r?.ok) { setOn(!next); return toast(d.follow.saveError); }
    start(() => router.refresh());
  }
  return (
    <button className={`btn${on ? " soft on" : ""}`} aria-pressed={on} disabled={disabled} onClick={click}>
      <Check />{disabled ? d.episode.notAired : on ? d.episode.watched : d.episode.markWatched}
    </button>
  );
}
