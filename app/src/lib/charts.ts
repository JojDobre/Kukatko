import { fmt, type Dict } from "./i18n";
import { newArrivals, providerList, removedRecently, topRated, upcoming, type Card, type Ctx } from "./queries";

type Prov = { id: number; name: string; slug: string };
export type ChartDef = { key: string; title: string; group: "general" | "platform"; provider?: Prov };

/** Zoznam rebríčkov pre región (všeobecné + pre každú väčšiu platformu). */
export async function chartList(ctx: Ctx, d: Dict): Promise<ChartDef[]> {
  const provs = (await providerList(ctx.region, 5)).slice(0, 10);
  const c = d.charts;
  const out: ChartDef[] = [
    { key: "this-week", title: c.thisWeek, group: "general" },
    { key: "new", title: d.home.newOnPlatforms, group: "general" },
    { key: "best-tv", title: c.bestTv, group: "general" },
    { key: "best-movies", title: c.bestMovies, group: "general" },
    { key: "leaving", title: c.leaving, group: "general" },
  ];
  for (const p of provs) {
    out.push({ key: `new-${p.slug}`, title: fmt(c.newOn, { p: p.name }), group: "platform", provider: p });
    out.push({ key: `best-tv-${p.slug}`, title: fmt(c.bestTvOn, { p: p.name }), group: "platform", provider: p });
    out.push({ key: `best-movies-${p.slug}`, title: fmt(c.bestMoviesOn, { p: p.name }), group: "platform", provider: p });
  }
  return out;
}

export type ChartRow = Card & { added?: Date; removed?: Date; removed_provider?: string };

export async function chartRows(ctx: Ctx, def: ChartDef): Promise<ChartRow[]> {
  const pid = def.provider?.id;
  const k = def.key;
  if (k === "this-week") return upcoming(ctx, 60, [], undefined, 7);
  if (k === "leaving") return removedRecently(ctx, 60, 30);
  if (k === "new" || k.startsWith("new-")) return newArrivals(ctx, { limit: 60, providerId: pid, days: 30 });
  if (k.startsWith("best-tv")) return topRated(ctx, "tv", 60, pid ? [pid] : []);
  if (k.startsWith("best-movies")) return topRated(ctx, "movie", 60, pid ? [pid] : []);
  return [];
}
