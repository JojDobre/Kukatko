"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./I18n";
import { toast } from "./toast";

/** Import z IMDb, Letterboxd alebo Trakt (súbor sa prečíta v prehliadači a pošle ako text). */
export default function ImportBox() {
  const { d, fmt } = useI18n();
  const t = d.importer;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (/\.zip$/i.test(f.name)) return toast(t.howLb);
    setBusy(true); setMsg(null);
    const text = await f.text();
    const r = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, text }) }).catch(() => null);
    setBusy(false);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j?.ok) return setMsg(t.error);
    setMsg(fmt(t.done, { r: j.r, w: j.w, s: j.s, u: j.u }) + (j.later ? ` ${t.later}` : ""));
    router.refresh();
  }
  return (
    <div className="tile w2">
      <div className="lbl"><span>{t.title}</span></div>
      <p className="muted">{t.intro}</p>
      <label className={`btn${busy ? " disabled" : ""}`} htmlFor="importFile" style={{ alignSelf: "flex-start" }}>{busy ? t.working : t.choose}</label>
      <input id="importFile" type="file" accept=".csv,.json,text/csv,application/json" hidden disabled={busy} onChange={onFile} />
      {msg && <p className="okbox" role="status" style={{ borderRadius: 14, padding: "10px 14px" }}>{msg}</p>}
      <details><summary className="link">{t.howto}</summary>
        <ul className="muted small"><li>{t.howImdb}</li><li>{t.howLb}</li><li>{t.howTrakt}</li></ul>
      </details>
    </div>
  );
}
