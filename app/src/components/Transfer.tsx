"use client";
import { useState } from "react";
import { useI18n } from "./I18n";
import { toast } from "./toast";
import { Copy } from "./icons";

/** Prenos sledovaných titulov na iné zariadenie: QR kód alebo krátky kód. */
export default function Transfer({ initialCode }: { initialCode?: string }) {
  const { d } = useI18n();
  const p = d.profile;
  const [code, setCode] = useState<{ code: string; url: string; qr: string } | null>(null);
  const [input, setInput] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const r = await fetch("/api/transfer", { method: "POST" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setBusy(false);
    if (!r) return toast(d.follow.saveError);
    setCode(r);
  }
  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/transfer", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: input }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return toast(p.codeInvalid);
    toast(p.transferDone);
    setTimeout(() => location.assign(location.pathname), 700);
  }
  async function copy() {
    if (!code) return;
    try { await navigator.clipboard.writeText(code.code); toast("OK"); } catch {}
  }

  return (
    <div className="tile w4 transfer">
      <div className="lbl"><span>{p.transfer}</span></div>
      <p className="muted">{p.transferText}</p>
      <div className="trow2">
        <div className="tcol">
          {code ? (
            <div className="qrbox">
              <img src={code.qr} alt="QR" width={168} height={168} />
              <div>
                <button className="tcode mono" onClick={copy} aria-label="Copy">{code.code} <Copy /></button>
                <small className="muted">{p.codeValid}</small>
              </div>
            </div>
          ) : <button className="btn" onClick={create} disabled={busy}>{p.createCode}</button>}
        </div>
        <form className="tcol" onSubmit={redeem}>
          <label htmlFor="tcode" className="muted" style={{ fontSize: 13 }}>{p.enterCode}</label>
          <div className="frow">
            <input id="tcode" className="inp mono" value={input} onChange={(e) => setInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              placeholder={p.codePlaceholder} autoComplete="off" inputMode="text" />
            <button className="btn soft" disabled={busy || input.length < 6}>{p.useCode}</button>
          </div>
          <small className="muted">{p.transferNote}</small>
        </form>
      </div>
    </div>
  );
}
