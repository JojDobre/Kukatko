"use client";
import { useEffect, useState } from "react";
import { toast } from "./toast";
import { currentSubscription, disablePush, enablePush, pushSupported } from "./push-client";

type Prefs = { episodes: boolean; seasons: boolean };

export default function Settings({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [push, setPush] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");

  useEffect(() => {
    if (!pushSupported()) return setPush(false);
    setDenied(Notification.permission === "denied");
    currentSubscription().then((s) => setPush(!!s));
    try { setTheme((localStorage.getItem("theme") as any) || "system"); } catch {}
  }, []);

  async function togglePush(on: boolean) {
    if (on) {
      const ok = await enablePush();
      setPush(ok);
      if (!ok) { setDenied(Notification.permission === "denied"); toast("Upozornenia sa nepodarilo zapnúť"); }
      else toast("Upozornenia zapnuté");
    } else {
      await disablePush();
      setPush(false);
      toast("Upozornenia vypnuté");
    }
  }

  async function savePref(k: keyof Prefs, v: boolean) {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    const res = await fetch("/api/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
    toast(res?.ok ? "Uložené" : "Nepodarilo sa uložiť");
  }

  function saveTheme(t: typeof theme) {
    setTheme(t);
    try { t === "system" ? localStorage.removeItem("theme") : localStorage.setItem("theme", t); } catch {}
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <>
      <div className="tile w2 set">
        <div className="lbl"><span>Upozornenia</span></div>
        <label htmlFor="pPush">
          <span>Upozornenia v tomto zariadení
            <small>{push === false && !pushSupported() ? "Tento prehliadač upozornenia nepodporuje. Na iPhone si najprv pridaj stránku na plochu."
              : denied ? "Upozornenia máš zablokované v nastaveniach prehliadača." : "Push správa, keď vyjde niečo, čo sleduješ"}</small>
          </span>
          <input id="pPush" type="checkbox" className="sw" checked={!!push} disabled={push === null || denied || !pushSupported()} onChange={(e) => togglePush(e.target.checked)} />
        </label>
        <label htmlFor="pEp">
          <span>Nové epizódy<small>V deň, keď epizóda vyjde</small></span>
          <input id="pEp" type="checkbox" className="sw" checked={prefs.episodes} onChange={(e) => savePref("episodes", e.target.checked)} />
        </label>
        <label htmlFor="pSeason">
          <span>Nové sezóny<small>Keď sa ohlási dátum premiéry</small></span>
          <input id="pSeason" type="checkbox" className="sw" checked={prefs.seasons} onChange={(e) => savePref("seasons", e.target.checked)} />
        </label>
      </div>
      <div className="tile w2 set">
        <div className="lbl"><span>Vzhľad</span></div>
        {(["system", "light", "dark"] as const).map((t) => (
          <label key={t} htmlFor={`th-${t}`}>
            <span>{t === "system" ? "Podľa zariadenia" : t === "light" ? "Svetlý" : "Tmavý"}</span>
            <input id={`th-${t}`} type="radio" name="theme" className="sw" checked={theme === t} onChange={() => saveTheme(t)} />
          </label>
        ))}
      </div>
    </>
  );
}
