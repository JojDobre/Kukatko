"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "./toast";
import { useI18n } from "./I18n";

export default function Rate({ titleId, initial }: { titleId: number; initial: number | null }) {
  const [v, setV] = useState(initial);
  const [, start] = useTransition();
  const router = useRouter();
  const { d, fmt } = useI18n();
  async function set(n: number) {
    const next = v === n ? null : n;
    const prev = v;
    setV(next);
    const res = await fetch("/api/rate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titleId, value: next }) }).catch(() => null);
    if (!res?.ok) { setV(prev); return toast(d.title.rateError); }
    toast(next ? fmt(d.title.rateSaved, { n: next }) : d.title.rateRemoved);
    start(() => router.refresh());
  }
  return (
    <div className="stars" role="group" aria-label={d.title.ratingGroup}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button key={n} data-on={v != null && n <= v} aria-pressed={v === n} onClick={() => set(n)}>{n}</button>
      ))}
    </div>
  );
}
