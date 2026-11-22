"use client";
import { useState } from "react";
import { useI18n } from "./I18n";
import { toast } from "./toast";

export default function PremiumBox({ site, price, until, hasCustomer }: { site: string; price: string; until: string | null; hasCustomer: boolean }) {
  const { d, fmt } = useI18n();
  const p = d.premium;
  const [busy, setBusy] = useState(false);
  async function go(path: string) {
    setBusy(true);
    const r = await fetch(path, { method: "POST" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setBusy(false);
    if (r?.url) location.assign(r.url); else toast(p.error);
  }
  return (
    <div className="tile w4 premium">
      <div className="lbl"><span>{p.title}</span></div>
      <h2>{fmt(p.heading, { site })}</h2>
      {until ? <p><b>{fmt(p.activeUntil, { date: until })}</b></p> : <p className="muted">{p.text}</p>}
      <ul className="perks">{p.perks.map((x) => <li key={x}>{x}</li>)}</ul>
      <div className="frow">
        {!until && <button className="btn" disabled={busy} onClick={() => go("/api/premium/checkout")}>{p.buy} · {fmt(p.price, { price })}</button>}
        {hasCustomer && <button className="btn soft" disabled={busy} onClick={() => go("/api/premium/portal")}>{p.manage}</button>}
      </div>
    </div>
  );
}
