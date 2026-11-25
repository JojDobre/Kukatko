import { sql } from "./db";
import { cached } from "./cache";
import { newArrivals, removedRecently, upcoming, card, type Card, type Ctx } from "./queries";
import type { ChartType } from "./charts";

export type Period = "all" | "year" | "5y" | number; // number = desaťročie, napr. 1990
export type ChartOpts = { kind?: "tv" | "movie" | null; providers: number[]; genre?: number[]; period?: Period; limit: number };
export type ChartItem = Card & { added?: Date; removed?: Date; removed_provider?: string; growth?: number | null };

/** Ktoré filtre dávajú pri ktorom rebríčku zmysel. */
export const CHART_FILTERS: Record<ChartType, { kind: boolean; period: boolean; size: boolean }> = {
  best: { kind: true, period: true, size: true },
  "best-tv": { kind: false, period: true, size: true },
  "best-movies": { kind: false, period: true, size: true },
  trending: { kind: true, period: false, size: true },
  "this-week": { kind: false, period: false, size: false },
  new: { kind: true, period: false, size: false },
  leaving: { kind: true, period: false, size: false },
};

const fixedKind = (type: ChartType, k: ChartOpts["kind"]) => (type === "best-tv" ? "tv" : type === "best-movies" ? "movie" : type === "this-week" ? "tv" : k ?? null);

function conds(c: Ctx, o: ChartOpts, kind: "tv" | "movie" | null) {
  const y = new Date().getFullYear();
  const p = o.period;
  return sql`${c.region} = ANY(t.regions)
    ${kind ? sql`AND t.kind = ${kind}` : sql``}
    ${o.providers.length ? sql`AND t.provider_keys && ${o.providers.map((x) => `${c.region}:${x}`)}::text[]` : sql``}
    ${o.genre?.length ? sql`AND t.genre_ids && ${o.genre}::int[]` : sql``}
    ${p === "year" ? sql`AND t.year = ${y}` : p === "5y" ? sql`AND t.year >= ${y - 4}` : typeof p === "number" ? sql`AND t.year BETWEEN ${p} AND ${p + 9}` : sql``}`;
}

/** Riadky rebríčka podľa typu a filtrov. */
export function chartList(c: Ctx, type: ChartType, o: ChartOpts): Promise<ChartItem[]> {
  const kind = fixedKind(type, o.kind);
  const key = `chart2:${c.lang}:${c.region}:${type}:${JSON.stringify({ ...o, kind })}`;
  return cached(key, 300, async () => {
    const byGenreKind = (rows: ChartItem[]) => rows.filter((r) => (!kind || r.kind === kind) && (!o.genre?.length || r.genre_ids.some((g) => o.genre!.includes(g))));
    switch (type) {
      case "best": case "best-tv": case "best-movies":
        return sql<ChartItem[]>`SELECT ${card(c)} FROM titles t
          WHERE t.score IS NOT NULL AND (t.tmdb_votes >= 50 OR t.imdb_votes >= 1000) AND ${conds(c, o, kind)}
          ORDER BY t.score DESC, t.popularity DESC LIMIT ${o.limit}`;
      case "trending":
        // Rast popularity za 7 dní; kým história nie je, zoradí sa podľa popularity.
        return sql<ChartItem[]>`
          WITH prev AS (SELECT title_id, popularity FROM title_pop WHERE day = (SELECT max(day) FROM title_pop WHERE day <= current_date - 7))
          SELECT ${card(c)}, CASE WHEN p.popularity > 0 THEN round(((t.popularity - p.popularity) / p.popularity * 100)::numeric)::int END AS growth
          FROM titles t LEFT JOIN prev p ON p.title_id = t.id
          WHERE t.popularity > 0 AND ${conds(c, o, kind)}
          ORDER BY CASE WHEN p.popularity IS NOT NULL THEN t.popularity - p.popularity END DESC NULLS LAST, t.popularity DESC
          LIMIT ${o.limit}`;
      case "this-week":
        return byGenreKind(await upcoming(c, 80, o.providers, undefined, 7));
      case "new":
        return byGenreKind(await newArrivals(c, { limit: 80, providers: o.providers, days: 30 }));
      case "leaving":
        return byGenreKind(await removedRecently(c, 80, 30, undefined, o.providers));
    }
  });
}

/** Kľúč uloženej histórie pre rebríček (len bez filtrov platforiem, žánru a obdobia). */
export function snapshotKey(type: ChartType, o: ChartOpts) {
  if (o.providers.length || o.genre?.length || (o.period && o.period !== "all")) return null;
  if (type === "trending") return o.kind ? `trending-${o.kind}` : "trending";
  if (type === "best" && o.kind) return o.kind === "tv" ? "best-tv" : "best-movies";
  return ["best", "best-tv", "best-movies"].includes(type) ? type : null;
}

/** Zmena poradia oproti stavu spred 7 dní: kladné číslo = posun hore, "new" = nový v rebríčku. Bez histórie null. */
export async function movement(region: string, chart: string | null, ids: number[]) {
  if (!chart || !ids.length) return null;
  const [d] = await sql<{ day: string }[]>`SELECT max(day)::text AS day FROM chart_ranks WHERE region = ${region} AND chart = ${chart} AND day <= current_date - 7`;
  if (!d?.day) return null;
  const prev = await sql<{ title_id: number; rank: number }[]>`SELECT title_id, rank FROM chart_ranks WHERE region = ${region} AND chart = ${chart} AND day = ${d.day}`;
  const m = new Map(prev.map((r) => [r.title_id, r.rank]));
  return new Map(ids.map((id, i) => [id, m.has(id) ? m.get(id)! - (i + 1) : ("new" as const)]));
}

/** Koľko dní za sebou je titul na 1. mieste rebríčka. */
export async function daysOnTop(region: string, chart: string, titleId: number) {
  const rows = await sql<{ title_id: number }[]>`SELECT title_id FROM chart_ranks WHERE region = ${region} AND chart = ${chart} AND rank = 1 ORDER BY day DESC LIMIT 120`;
  let n = 0;
  for (const r of rows) { if (r.title_id !== titleId) break; n++; }
  return n;
}

/** Robot: denná fotka popularity a poradia rebríčkov (pre šípky a trendy). */
export async function snapshotCharts(regions: string[]) {
  await sql`INSERT INTO title_pop (day, title_id, popularity) SELECT current_date, id, popularity FROM titles WHERE popularity > 0
    ON CONFLICT (day, title_id) DO UPDATE SET popularity = EXCLUDED.popularity`;
  const charts: [string, ChartType, ChartOpts["kind"]][] = [["best", "best", null], ["best-tv", "best-tv", null], ["best-movies", "best-movies", null], ["trending", "trending", null], ["trending-tv", "trending", "tv"], ["trending-movie", "trending", "movie"]];
  const [{ today }] = await sql<{ today: string }[]>`SELECT current_date::text AS today`;
  let rows = 0;
  for (const region of regions) {
    const c: Ctx = { lang: "en", region };
    for (const [key, type, kind] of charts) {
      const list = await chartList(c, type, { kind, providers: [], limit: 100 });
      if (!list.length) continue;
      await sql`DELETE FROM chart_ranks WHERE region = ${region} AND chart = ${key} AND day = current_date`;
      await sql`INSERT INTO chart_ranks ${sql(list.map((t, i) => ({ region, chart: key, day: today, title_id: t.id, rank: i + 1 })), "region", "chart", "day", "title_id", "rank")}`;
      rows += list.length;
    }
  }
  await sql`DELETE FROM chart_ranks WHERE day < current_date - 45`;
  await sql`DELETE FROM title_pop WHERE day < current_date - 60`;
  return { regions: regions.length, rows };
}
