"use client";
import { useEffect, useState } from "react";
import { toast } from "./toast";
import { useI18n } from "./I18n";
import { currentSubscription, disablePush, enablePush, pushSupported } from "./push-client";

type Prefs = { episodes: boolean; seasons: boolean; availability: boolean; reminder: boolean };

export default function Settings({ initial, premium, premiumEnabled }: { initial: Prefs; premium: boolean; premiumEnabled: boolean }) {
  const { d } = useI18n();
  const p = d.profile;
  const [prefs, setPrefs] = useState(initial);
  const [push, setPush] = useState<boolean | null>(null);
  const [supported, setSupported] = useState(true);
  const [denied, setDenied] = useState(false);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");

  useEffect(() => {
    const ok = pushSupported();
    setSupported(ok);
    try { setTheme((localStorage.getItem("theme") as any) || "system"); } catch {}
    if (!ok) return setPush(false);
    setDenied(Notification.permission === "denied");
    currentSubscription().then((s) => setPush(!!s));
  }, []);

  async function togglePush(on: boolean) {
    if (on) {
      const ok = await enablePush();
      setPush(ok);
      if (!ok) { setDenied(Notification.permission === "denied"); toast(d.follow.pushFail); } else toast(d.follow.pushOn);
    } else {
      await disablePush();
      setPush(false);
      toast(p.off);
    }
  }

  async function savePref(k: keyof Prefs, v: boolean) {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    const res = await fetch("/api/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
    toast(res?.ok ? p.saved : d.follow.saveError);
  }

  function saveTheme(t: typeof theme) {
    setTheme(t);
    try { t === "system" ? localStorage.removeItem("theme") : localStorage.setItem("theme", t); } catch {}
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  const row = (id: string, title: string, hint: string, checked: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <label htmlFor={id}>
      <span>{title}<small>{hint}</small></span>
      <input id={id} type="checkbox" className="sw" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );

  return (
    <>
      <div className="tile w2 set">
        <div className="lbl"><span>{p.notifications}</span></div>
        {row("pPush", p.pushDevice, !supported ? p.pushUnsupported : denied ? p.pushBlocked : p.pushHint, !!push, togglePush, push === null || denied || !supported)}
        {row("pEp", p.episodes, p.episodesHint, prefs.episodes, (v) => savePref("episodes", v))}
        {row("pSeason", p.seasons, p.seasonsHint, prefs.seasons, (v) => savePref("seasons", v))}
        {row("pAvail", p.availability, p.availabilityHint, prefs.availability, (v) => savePref("availability", v))}
        {premiumEnabled && row("pRem", p.reminder, premium ? p.reminderHint : `${p.reminderHint} (${p.premiumOnly})`, premium && prefs.reminder, (v) => savePref("reminder", v), !premium)}
      </div>
      <div className="tile w2 set">
        <div className="lbl"><span>{p.appearance}</span></div>
        {(["system", "light", "dark"] as const).map((t) => (
          <label key={t} htmlFor={`th-${t}`}>
            <span>{t === "system" ? p.themeSystem : t === "light" ? p.themeLight : p.themeDark}</span>
            <input id={`th-${t}`} type="radio" name="theme" className="sw" checked={theme === t} onChange={() => saveTheme(t)} />
          </label>
        ))}
      </div>
    </>
  );
}
