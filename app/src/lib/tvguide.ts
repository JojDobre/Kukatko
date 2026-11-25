import { sql } from "./db";
import { cached } from "./cache";
import { regionTz } from "./locales";
import { card, type Card, type Ctx, type KindOpt } from "./queries";

export type TvRow = Card & {
  airing_id: number; starts_at: Date; ends_at: Date | null; channel: string; channel_icon: string | null;
  season: number | null; episode: number | null; sub_title: string | null;
};

/** TV deň začína o 5:00 (nočné filmy po polnoci patria ešte k večeru). */
const tvDate = (col: ReturnType<typeof sql>, tz: string) => sql`((${col} AT TIME ZONE ${tz}) - interval '5 hours')::date`;
const kindCond = (k: KindOpt) => (k === "all" ? sql`` : sql`AND t.kind = ${k}`);

const cols = (c: Ctx) => sql`${card(c)}, a.id AS airing_id, a.starts_at, a.ends_at, a.season, a.episode, a.sub_title,
  ch.name AS channel, ch.icon AS channel_icon`;
const from = () => sql`FROM tv_airings a JOIN titles t ON t.id = a.title_id JOIN tv_channels ch ON ch.region = a.region AND ch.id = a.channel_id`;

/** Celý TV deň (0 = dnes) pre krajinu: podľa času alebo podľa hodnotenia. */
export function tvDay(c: Ctx, offset: number, kind: KindOpt, sort: "score" | "time", limit = 400) {
  const tz = regionTz(c.region);
  return sql<TvRow[]>`SELECT ${cols(c)} ${from()}
    WHERE a.region = ${c.region} AND ${tvDate(sql`a.starts_at`, tz)} = ${tvDate(sql`now()`, tz)} + ${offset}::int ${kindCond(kind)}
    ORDER BY ${sort === "score" ? sql`t.score DESC NULLS LAST, a.starts_at` : sql`a.starts_at, t.score DESC NULLS LAST`} LIMIT ${limit}`;
}

/** Najlepšie, čo ešte dnes v TV pôjde (každý titul raz, najbližšie vysielanie). */
export function tvBestToday(c: Ctx, kind: KindOpt, limit = 6) {
  const tz = regionTz(c.region);
  return cached(`tvbest:${c.lang}:${c.region}:${kind}:${limit}`, 300, () => sql<TvRow[]>`
    SELECT * FROM (
      SELECT DISTINCT ON (t.id) ${cols(c)} ${from()}
      WHERE a.region = ${c.region} AND coalesce(a.ends_at, a.starts_at + interval '90 minutes') > now()
        AND ${tvDate(sql`a.starts_at`, tz)} = ${tvDate(sql`now()`, tz)} AND t.score IS NOT NULL ${kindCond(kind)}
      ORDER BY t.id, a.starts_at
    ) x ORDER BY score DESC, starts_at LIMIT ${limit}`);
}

/** Najbližšie vysielania titulu v TV (detail titulu). */
export function tvForTitle(c: Ctx, titleId: number, limit = 3) {
  return sql<{ starts_at: Date; channel: string; season: number | null; episode: number | null }[]>`
    SELECT a.starts_at, ch.name AS channel, a.season, a.episode
    FROM tv_airings a JOIN tv_channels ch ON ch.region = a.region AND ch.id = a.channel_id
    WHERE a.title_id = ${titleId} AND a.region = ${c.region} AND a.starts_at > now() - interval '30 minutes'
    ORDER BY a.starts_at LIMIT ${limit}`;
}

/** Má krajina nejaký TV program? (Inak sekciu ani odkaz neukazujeme.) */
export function tvHasData(region: string) {
  return cached(`tvhas:${region}`, 600, async () => {
    const [r] = await sql<{ ok: boolean }[]>`SELECT EXISTS (SELECT 1 FROM tv_airings WHERE region = ${region} AND starts_at > now() - interval '3 hours') AS ok`;
    return !!r?.ok;
  });
}

/** Čas vysielania v časovom pásme krajiny. */
export function tvTime(d: Date, region: string, intl: string) {
  return d.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit", timeZone: regionTz(region) });
}
