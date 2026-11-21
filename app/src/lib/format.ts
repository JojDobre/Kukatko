const TZ = process.env.TZ_DISPLAY ?? "Europe/Bratislava";

export function todayISO(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
}

export function daysUntil(dateISO: string | null | undefined): number | null {
  if (!dateISO) return null;
  const a = Date.parse(todayISO() + "T00:00:00Z");
  const b = Date.parse(String(dateISO).slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 864e5);
}

export function rel(n: number | null): string {
  if (n === null) return "";
  if (n < 0) return n === -1 ? "včera" : `pred ${-n} dňami`;
  if (n === 0) return "dnes";
  if (n === 1) return "zajtra";
  return `o ${n} ${n < 5 ? "dni" : "dní"}`;
}

export function fmtDate(dateISO: string | null | undefined): string {
  if (!dateISO) return "";
  return new Date(String(dateISO).slice(0, 10) + "T12:00:00Z").toLocaleDateString("sk-SK", {
    weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC",
  });
}

export function plural(n: number, one: string, few: string, many: string) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}

export function epCode(season: number, episode: number) {
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "serial";
}

export function tone(v: number | null | undefined) {
  if (v == null) return "var(--muted)";
  return v >= 80 ? "var(--good)" : v >= 65 ? "var(--mid)" : "var(--low)";
}

export const img = (path: string | null | undefined, size: "w185" | "w342" | "w500" | "w780" | "w1280" | "h632" = "w342") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

/** Náhradná farba plagátu, kým sa nenačíta obrázok (alebo keď chýba). */
export function hue(id: number) {
  return (id * 47) % 360;
}
