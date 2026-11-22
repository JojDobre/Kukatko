"use client";
import { useState } from "react";
import { useI18n } from "./I18n";

/** Zdieľanie obrázka „Môj rok“ (v telefóne cez systémové zdieľanie, inak stiahnutie). */
export default function ShareRecap({ year, title }: { year: number; title: string }) {
  const { d } = useI18n();
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    try {
      const blob = await fetch(`/api/stats/image?year=${year}`).then((r) => r.blob());
      const file = new File([blob], `kukatko-${year}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title });
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
    } catch { /* zrušené */ }
    setBusy(false);
  }
  return <button className="btn" disabled={busy} onClick={share}>{d.stats.share}</button>;
}
