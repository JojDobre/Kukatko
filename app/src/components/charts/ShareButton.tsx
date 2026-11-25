"use client";
import { useI18n } from "../I18n";
import { toast } from "../toast";

/** Zdieľanie rebríčka: systémové zdieľanie, inak skopíruje odkaz. */
export default function ShareButton({ title }: { title: string }) {
  const { d } = useI18n();
  async function share() {
    const url = location.href;
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch { return; } }
    try { await navigator.clipboard.writeText(url); toast(d.charts.copied); } catch {}
  }
  return (
    <button className="ibtn" onClick={share} aria-label={d.charts.share}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v13M7 8l5-5 5 5M5 14v6h14v-6" /></svg>
    </button>
  );
}
