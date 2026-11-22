"use client";
import { useState } from "react";
import { useI18n } from "./I18n";
import { toast } from "./toast";

export default function TogetherBox() {
  const { d } = useI18n();
  const t = d.together;
  const [url, setUrl] = useState<string | null>(null);
  async function create() {
    const r = await fetch("/api/together", { method: "POST" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (r?.url) setUrl(r.url); else toast(d.follow.saveError);
  }
  async function share() {
    if (!url) return;
    if (navigator.share) { try { await navigator.share({ title: t.title, url }); return; } catch { /* zrušené */ } }
    try { await navigator.clipboard.writeText(url); toast(t.copied); } catch { toast(url); }
  }
  return (
    <div className="tile w4">
      <div className="lbl"><span>{t.title}</span></div>
      <p className="muted">{t.intro}</p>
      {!url ? <button className="btn" style={{ alignSelf: "flex-start" }} onClick={create}>{t.create}</button> : (
        <>
          <label className="muted small" htmlFor="tlink">{t.link}</label>
          <div className="frow">
            <input id="tlink" className="inp mono" readOnly value={url} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
            <button className="btn" onClick={share}>{t.share}</button>
          </div>
          <small className="muted">{t.valid} {t.waiting}</small>
        </>
      )}
    </div>
  );
}
