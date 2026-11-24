"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { platformStyle } from "@/lib/platforms";
import { useI18n } from "./I18n";
import { toast } from "./toast";

type Prov = { id: number; name: string; count: number };

/** Profil: výber krajiny (platformy a TV program) a predplatených platforiem. */
export default function RegionPlatforms({ regions, region, providers, selected }: {
  regions: { code: string; name: string }[]; region: string; providers: Prov[]; selected: number[];
}) {
  const { d } = useI18n();
  const p = d.profile;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [plats, setPlats] = useState(selected);

  async function changeRegion(code: string) {
    document.cookie = `region=${code}; path=/; max-age=31536000; samesite=lax`;
    // Zariadenie si krajinu zapamätá aj na serveri (upozornenia posiela podľa nej).
    await fetch("/api/region", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    start(() => router.refresh());
  }

  async function toggle(id: number) {
    const next = plats.includes(id) ? plats.filter((x) => x !== id) : [...plats, id];
    setPlats(next);
    document.cookie = `plats_${region}=${next.join(".")}; path=/; max-age=31536000; samesite=lax`;
    const res = await fetch("/api/platforms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ region, ids: next }) }).catch(() => null);
    toast(res?.ok ? p.saved : d.follow.saveError);
  }

  return (
    <div className="tile w4 set regplat" aria-busy={pending}>
      <div className="lbl"><span>{p.regionSection}</span></div>
      <label htmlFor="pRegion">
        <span>{p.region}<small>{p.regionHint}</small></span>
        <select id="pRegion" className="sel" value={region} onChange={(e) => changeRegion(e.target.value)}>
          {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
        </select>
      </label>
      <div className="pblock">
        <span>{p.myPlatforms}<small>{p.myPlatformsHint}</small></span>
        {providers.length ? (
          <div className="pgrid" role="group" aria-label={p.myPlatforms}>
            {providers.map((x) => {
              const st = platformStyle(x.name);
              const on = plats.includes(x.id);
              return (
                <button key={x.id} className={`pchip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggle(x.id)}>
                  <span className="pdot" style={{ background: st.color }} />{x.name}<span className="cnt">{x.count}</span>
                </button>
              );
            })}
          </div>
        ) : <p className="muted">{p.noProviders}</p>}
        {providers.length > 0 && plats.length === 0 && <small>{p.platformsNone}</small>}
      </div>
    </div>
  );
}
