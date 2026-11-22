import sk, { type Dict } from "./sk";
import cs from "./cs";
import en from "./en";
import pl from "./pl";
import hu from "./hu";
import de from "./de";
import type { Lang } from "../locales";

const DICTS: Record<Lang, Dict> = { sk, cs, en, pl, hu, de };
export type { Dict };
export const dict = (lang: Lang): Dict => DICTS[lang] ?? sk;

type Forms = { one: string; few: string; many: string; other: string };

/** Nahradí {kľúč} hodnotami. */
export function fmt(s: string, vars: Record<string, string | number> = {}) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Správny tvar podľa čísla (1 deň, 2 dni, 5 dní…) pre daný jazyk. */
export function plural(forms: Forms, n: number, lang: Lang, vars: Record<string, string | number> = {}) {
  const cat = new Intl.PluralRules(lang).select(n) as keyof Forms | "zero" | "two";
  const s = (forms as any)[cat] ?? forms.other;
  return fmt(s, { n, ...vars });
}
