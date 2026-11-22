"use client";
import { useState } from "react";
import { useI18n } from "./I18n";
import { toast } from "./toast";

export default function IcalBox() {
  const { d } = useI18n();
  const t = d.ical;
  const [links, setLinks] = useState<{ https: string; webcal: string } | null>(null);
  async function load() {
    const r = await fetch("/api/ical", { method: "POST" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (r) setLinks(r); else toast(d.follow.saveError);
  }
  return (
    <div className="tile w2">
      <div className="lbl"><span>{t.title}</span></div>
      <p className="muted">{t.intro}</p>
      {!links ? <button className="btn" style={{ alignSelf: "flex-start" }} onClick={load}>{t.title}</button> : (
        <div className="frow">
          <a className="btn" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(links.webcal)}`} target="_blank" rel="noopener">{t.google}</a>
          <a className="btn soft" href={links.webcal}>{t.apple}</a>
          <button className="btn soft" onClick={async () => { try { await navigator.clipboard.writeText(links.https); toast(d.together.copied); } catch { toast(links.https); } }}>{t.copy}</button>
        </div>
      )}
      {links && <small className="muted">{t.note}</small>}
    </div>
  );
}
