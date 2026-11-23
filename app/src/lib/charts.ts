import { fmt, type Dict } from "./i18n";
import { newArrivals, providerList, removedRecently, topRated, trending, upcoming, type Card, type Ctx } from "./queries";

export type Prov = { id: number; name: string; slug: string; logo_path: string | null; count: number };

/** Typy rebríčkov v poradí, v akom sa ukazujú. */
export const CHART_TYPES = ["best", "trending", "best-tv", "best-movies", "this-week", "new", "leaving"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export function typeTitle(t: ChartType, d: Dict) {
  const c = d.charts;
  return { best: c.bestAll, trending: c.trending, "best-tv": c.bestTv, "best-movies": c.bestMovies,
    "this-week": c.thisWeek, new: d.home.newOnPlatforms, leaving: c.leaving }[t];
}

/** Rebríčky platforiem v adrese (kvôli vyhľadávaču), napr. „new-netflix“, „best-tv-hbo-max“. */
const PREFIXED: ChartType[] = ["best-movies", "best-tv", "best", "trending", "this-week", "new", "leaving"];

export type ChartSel = { type: ChartType; provider: Prov | null };

/** Rozloží kľúč z adresy na typ rebríčka a prípadne jednu platformu. */
export async function parseChartKey(ctx: Ctx, key: string): Promise<ChartSel | null> {
  if ((CHART_TYPES as readonly string[]).includes(key)) return { type: key as ChartType, provider: null };
  const provs = await providerList(ctx.region, 1);
  for (const t of PREFIXED) {
    if (!key.startsWith(`${t}-`)) continue;
    const p = provs.find((x) => x.slug === key.slice(t.length + 1));
    if (p) return { type: t, provider: p };
  }
  return null;
}

/** Nadpis rebríčka (pri jednej platforme v adrese vrátane jej mena). */
export function chartTitle(sel: ChartSel, d: Dict) {
  const c = d.charts;
  if (!sel.provider) return typeTitle(sel.type, d);
  const p = sel.provider.name;
  const m: Partial<Record<ChartType, string>> = { new: c.newOn, "best-tv": c.bestTvOn, "best-movies": c.bestMoviesOn, best: c.bestOn };
  return m[sel.type] ? fmt(m[sel.type]!, { p }) : `${typeTitle(sel.type, d)}: ${p}`;
}

export type ChartRow = Card & { added?: Date; removed?: Date; removed_provider?: string };

export async function chartRows(ctx: Ctx, type: ChartType, providers: number[]): Promise<ChartRow[]> {
  switch (type) {
    case "best": return topRated(ctx, null, 50, providers);
    case "trending": return trending(ctx, null, 50, providers);
    case "best-tv": return topRated(ctx, "tv", 50, providers);
    case "best-movies": return topRated(ctx, "movie", 50, providers);
    case "this-week": return upcoming(ctx, 60, providers, undefined, 7);
    case "new": return newArrivals(ctx, { limit: 60, providers, days: 30 });
    case "leaving": return removedRecently(ctx, 60, 30, undefined, providers);
  }
}

/** Zoznam adries rebríčkov pre mapu stránok. */
export async function chartKeys(ctx: Ctx) {
  const provs = (await providerList(ctx.region, 5)).slice(0, 10);
  return [...CHART_TYPES, ...provs.flatMap((p) => (["new", "best-tv", "best-movies", "best"] as const).map((t) => `${t}-${p.slug}`))];
}
