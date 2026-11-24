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
/** Krajiny EÚ (TMDB/JustWatch pre ne má dostupnosť na platformách). */
export const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
/** „Celý svet“: katalóg bez obmedzenia na krajinu, platformy zo všetkých krajín spolu. */
export const GLOBAL = "GLOBAL";

/**
 * Ďalšie krajiny bez vlastného jazyka. Predvolene USA a celá EÚ.
 * EXTRA_REGIONS="AT,CH" ich nahradí vlastným zoznamom, EXTRA_REGIONS=none vypne.
 */
const extraEnv = process.env.EXTRA_REGIONS?.trim();
const EXTRA = extraEnv === "none" ? [] : (extraEnv ? extraEnv.split(",") : ["US", ...EU]).map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s));
/** Krajiny jazykov (celá nočná synchronizácia) – ostatné sa sťahujú v menšom rozsahu. */
export const MAIN_REGIONS: string[] = [...new Set(LANGS.map((l) => ALL_LOCALES[l].region as string))];
/** Skutočné krajiny (pre TMDB). */
export const COUNTRIES: string[] = [...new Set([...MAIN_REGIONS, ...EXTRA])];
/** Všetko, čo si užívateľ môže zvoliť, vrátane „Celý svet“. */
export const REGIONS: string[] = [...COUNTRIES, GLOBAL];
export const isRegion = (s: unknown): s is string => typeof s === "string" && REGIONS.includes(s);

const GLOBAL_NAME: Record<Lang, string> = { sk: "Celý svet", cs: "Celý svět", en: "Worldwide", pl: "Cały świat", hu: "Egész világ", de: "Weltweit" };
/** Názov krajiny v jazyku stránky (Slovensko, Česko, Rakúsko…). */
export function regionName(code: string, lang: Lang) {
  if (code === GLOBAL) return GLOBAL_NAME[lang];
  try { return new Intl.DisplayNames([ALL_LOCALES[lang].intl], { type: "region" }).of(code) ?? code; } catch { return code; }
}

/** Časové pásmo krajiny (TV program). */
const TZ: Record<string, string> = {
  SK: "Europe/Bratislava", CZ: "Europe/Prague", GB: "Europe/London", PL: "Europe/Warsaw", HU: "Europe/Budapest", DE: "Europe/Berlin",
  AT: "Europe/Vienna", CH: "Europe/Zurich", IE: "Europe/Dublin", FR: "Europe/Paris", IT: "Europe/Rome", ES: "Europe/Madrid", NL: "Europe/Amsterdam",
  US: "America/New_York", CA: "America/Toronto",
};
export const regionTz = (code: string) => TZ[code] ?? "Europe/Bratislava";

export const isLang = (s: unknown): s is Lang => typeof s === "string" && (LANGS as string[]).includes(s);
export const loc = (l: Lang) => ALL_LOCALES[l];
export const regionOf = (l: Lang) => ALL_LOCALES[l].region;

/** Adresa v danom jazyku: predvolený jazyk nemá predponu. */
export function href(lang: Lang, path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return lang === DEFAULT_LANG ? p : `/${lang}${p === "/" ? "" : p}`;
}
