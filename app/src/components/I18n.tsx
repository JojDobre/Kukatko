"use client";
import { createContext, useContext } from "react";
import type { Dict } from "@/lib/i18n/sk";
import { fmt, plural } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";

type Ctx = { lang: Lang; d: Dict; defaultLang: Lang; langs: { code: Lang; name: string }[] };
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

/** Texty a jazyk v klientských komponentoch. */
export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n mimo I18nProvider");
  const href = (p: string) => (c.lang === c.defaultLang ? p : `/${c.lang}${p === "/" ? "" : p}`);
  return { ...c, href, fmt, plural: (forms: Parameters<typeof plural>[0], n: number, vars?: Record<string, string | number>) => plural(forms, n, c.lang, vars) };
}
