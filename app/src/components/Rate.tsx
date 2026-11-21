"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "./toast";

export default function Rate({ showId, initial }: { showId: number; initial: number | null }) {
  const [v, setV] = useState(initial);
  const [, start] = useTransition();
  const router = useRouter();
  async function set(n: number) {
    const next = v === n ? null : n;
    setV(next);
    const res = await fetch("/api/rate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showId, value: next }) }).catch(() => null);
    if (!res?.ok) { setV(v); return toast("Hodnotenie sa nepodarilo uložiť"); }
    toast(next ? `Tvoje hodnotenie: ${next}/10` : "Hodnotenie zrušené");
    start(() => router.refresh());
  }
  return (
    <div className="stars" role="group" aria-label="Tvoje hodnotenie od 1 do 10">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button key={n} data-on={v != null && n <= v} aria-pressed={v === n} onClick={() => set(n)}>{n}</button>
      ))}
    </div>
  );
}
