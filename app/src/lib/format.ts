import { ALL_LOCALES, type Lang } from "./locales";
import { dict, plural } from "./i18n";

const TZ = process.env.TZ_DISPLAY ?? "Europe/Bratislava";

export function todayISO(tz = TZ): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(new Date());
}

export function addDaysISO(iso: string, days: number) {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(dateISO: string | null | undefined): number | null {
  if (!dateISO) return null;
  const a = Date.parse(todayISO() + "T00:00:00Z");
  const b = Date.parse(String(dateISO).slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 864e5);
}

/** „dnes“, „zajtra“, „o 3 dni“, „pred 2 dňami“ v danom jazyku. */
export function rel(n: number | null, lang: Lang): string {
  if (n === null) return "";
  const t = dict(lang).time;
  if (n === 0) return t.today;
  if (n === 1) return t.tomorrow;
  if (n === -1) return t.yesterday;
  return n > 0 ? plural(t.inDays, n, lang) : plural(t.daysAgo, -n, lang);
}

export function fmtDate(dateISO: string | null | undefined, lang: Lang, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "numeric" }): string {
  if (!dateISO) return "";
  return new Date(String(dateISO).slice(0, 10) + "T12:00:00Z").toLocaleDateString(ALL_LOCALES[lang].intl, { ...opts, timeZone: "UTC" });
}

export function epCode(season: number, episode: number) {
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[łŁ]/g, "l").replace(/ß/g, "ss").replace(/[øØ]/g, "o")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "titul";
}

export function tone(v: number | null | undefined) {
  if (v == null) return "var(--muted)";
  return v >= 80 ? "var(--good)" : v >= 65 ? "var(--mid)" : "var(--low)";
}

export const img = (path: string | null | undefined, size: "w92" | "w185" | "w342" | "w500" | "w780" | "w1280" | "h632" = "w342") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

/** Náhradná farba plagátu, kým sa nenačíta obrázok (alebo keď chýba). */
export function hue(id: number) {
  return (id * 47) % 360;
}
