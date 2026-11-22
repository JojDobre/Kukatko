/**
 * Jazykové verzie. Každý jazyk má svoj región (podľa neho sa ukazujú platformy)
 * a názov v danom jazyku. Ktoré sú zapnuté, určuje premenná LOCALES (napr. "sk,cs,en").
 */
export const ALL_LOCALES = {
  sk: { name: "Slovenčina", region: "SK", regionName: "Slovensko", tmdb: "sk-SK", intl: "sk-SK", fallback: ["cs", "en"], og: "sk_SK", tz: "Europe/Bratislava" },
  cs: { name: "Čeština", region: "CZ", regionName: "Česko", tmdb: "cs-CZ", intl: "cs-CZ", fallback: ["sk", "en"], og: "cs_CZ", tz: "Europe/Prague" },
  en: { name: "English", region: "GB", regionName: "United Kingdom", tmdb: "en-GB", intl: "en-GB", fallback: [], og: "en_GB", tz: "Europe/London" },
  pl: { name: "Polski", region: "PL", regionName: "Polska", tmdb: "pl-PL", intl: "pl-PL", fallback: ["en"], og: "pl_PL", tz: "Europe/Warsaw" },
  hu: { name: "Magyar", region: "HU", regionName: "Magyarország", tmdb: "hu-HU", intl: "hu-HU", fallback: ["en"], og: "hu_HU", tz: "Europe/Budapest" },
  de: { name: "Deutsch", region: "DE", regionName: "Deutschland", tmdb: "de-DE", intl: "de-DE", fallback: ["en"], og: "de_DE", tz: "Europe/Berlin" },
} as const;

export type Lang = keyof typeof ALL_LOCALES;

function parse(v: string | undefined): Lang[] {
  const list = (v ?? "sk,cs,en,pl,hu,de").split(",").map((s) => s.trim()).filter((s): s is Lang => s in ALL_LOCALES);
  return list.length ? list : ["sk"];
}

/** Zapnuté jazyky. Prvý je predvolený (bez predpony v adrese). */
export const LANGS: Lang[] = parse(process.env.LOCALES);
export const DEFAULT_LANG: Lang = LANGS[0];
export const REGIONS = [...new Set(LANGS.map((l) => ALL_LOCALES[l].region))];

export const isLang = (s: unknown): s is Lang => typeof s === "string" && (LANGS as string[]).includes(s);
export const loc = (l: Lang) => ALL_LOCALES[l];
export const regionOf = (l: Lang) => ALL_LOCALES[l].region;

/** Adresa v danom jazyku: predvolený jazyk nemá predponu. */
export function href(lang: Lang, path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return lang === DEFAULT_LANG ? p : `/${lang}${p === "/" ? "" : p}`;
}
