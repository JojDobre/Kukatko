"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "./icons";
import { useI18n } from "./I18n";

/** Prepínač jazyka. Každý jazyk je napísaný po svojom (Slovenčina, Čeština, Deutsch…). */
export default function LangSwitch() {
  const { lang, langs, defaultLang, d } = useI18n();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  if (langs.length < 2) return null;

  // Cesta bez predpony jazyka, aby sme ostali na tej istej stránke.
  const bare = lang === defaultLang ? path : path.replace(new RegExp(`^/${lang}(?=/|$)`), "") || "/";
  const to = (l: string) => (l === defaultLang ? bare : `/${l}${bare === "/" ? "" : bare}`);

  return (
    <div className="dd lang" ref={box}>
      <button className="round" aria-haspopup="menu" aria-expanded={open} aria-label={d.common.language} onClick={() => setOpen(!open)}>
        <Globe /><span className="lcode">{lang.toUpperCase()}</span>
      </button>
      {open && (
        <div className="ddm" role="menu">
          {langs.map((l) => (
            // Obyčajný odkaz (nie Link): nový jazyk = nové rozloženie stránky a cookie.
            <a key={l.code} role="menuitemradio" aria-checked={l.code === lang} href={to(l.code)} hrefLang={l.code} lang={l.code}
              onClick={(e) => {
                document.cookie = `lang=${l.code}; path=/; max-age=31536000; samesite=lax`;
                e.currentTarget.href = to(l.code) + location.search; // zachová filtre v adrese
              }}>
              <span>{l.name}</span><span className="ck">{l.code === lang && <Check />}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
