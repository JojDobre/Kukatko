import { sql } from "./db";
import { todayISO } from "./format";
import type { Ep } from "./tmdb";

export type Show = {
  id: number; slug: string; name: string; original_name: string | null; overview: string | null; tagline: string | null;
  poster_path: string | null; backdrop_path: string | null; first_air_date: string | null; year: number | null;
  status: string | null; genres: string[]; seasons: number | null; episodes: number | null; creators: string[];
  cast: { name: string; character: string | null; profile_path: string | null }[];
  providers: { id: number; name: string; logo_path: string | null; type: string }[];
  watch_link: string | null; next_ep: Ep | null; next_air_date: string | null; last_ep: Ep | null;
  current_season: { episode: number; name: string; air_date: string | null }[] | null;
  trailer_key: string | null; tmdb_rating: number | null; tmdb_votes: number; imdb_id: string | null;
  imdb_rating: number | null; rt_rating: number | null; user_avg: number | null; user_count: number; score: number | null;
};

/** Stĺpce pre karty v mriežke (bez ťažkých polí). */
const card = () => sql`id, slug, name, poster_path, backdrop_path, year, genres, seasons, providers, next_ep,
  next_air_date, tmdb_rating, tmdb_votes, imdb_rating, rt_rating,
  user_avg, user_count, score, overview`;

export type Card = Pick<Show, "id" | "slug" | "name" | "poster_path" | "backdrop_path" | "year" | "genres" | "seasons" |
  "providers" | "next_ep" | "next_air_date" | "tmdb_rating" | "tmdb_votes" | "imdb_rating" | "rt_rating" |
  "user_avg" | "user_count" | "score" | "overview">;

export const SORTS = {
  score: { label: "Priemer", order: "score DESC NULLS LAST, popularity DESC" },
  popular: { label: "Populárne", order: "popularity DESC" },
  imdb: { label: "IMDb", order: "imdb_rating DESC NULLS LAST, imdb_votes DESC NULLS LAST" },
  tmdb: { label: "TMDB", order: "(CASE WHEN tmdb_votes >= 20 THEN tmdb_rating END) DESC NULLS LAST, tmdb_votes DESC" },
  rt: { label: "Rotten Tomatoes", order: "rt_rating DESC NULLS LAST, popularity DESC" },
  users: { label: "Užívatelia", order: "(CASE WHEN user_count >= 5 THEN user_avg END) DESC NULLS LAST, user_count DESC" },
  next: { label: "Najbližšia epizóda", order: "next_air_date ASC NULLS LAST, popularity DESC" },
  new: { label: "Najnovšie", order: "first_air_date DESC NULLS LAST" },
} as const;
export type SortKey = keyof typeof SORTS;
export const isSort = (s: any): s is SortKey => typeof s === "string" && s in SORTS;

export const PAGE_SIZE = 30;

export async function catalog(opts: { sort: SortKey; providers: number[]; genre: string | null; page: number }) {
  const where = [sql`TRUE`];
  if (opts.providers.length) where.push(sql`provider_ids && ${opts.providers}::int[]`);
  if (opts.genre) where.push(sql`${opts.genre} = ANY(genres)`);
  if (opts.sort === "next") where.push(sql`next_air_date >= ${todayISO()}`);
  const cond = where.reduce((a, b) => sql`${a} AND ${b}`);
  const offset = (Math.max(1, opts.page) - 1) * PAGE_SIZE;
  const [rows, [{ count }]] = await Promise.all([
    sql<Card[]>`SELECT ${card()} FROM shows WHERE ${cond}
      ORDER BY ${sql.unsafe(SORTS[opts.sort].order)} LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM shows WHERE ${cond}`,
  ]);
  return { rows, total: count };
}

export async function upcoming(limit: number, providers: number[] = [], ids?: number[]) {
  return sql<Card[]>`SELECT ${card()} FROM shows
    WHERE next_air_date >= ${todayISO()}
      ${providers.length ? sql`AND provider_ids && ${providers}::int[]` : sql``}
      ${ids ? sql`AND id = ANY(${ids}::int[])` : sql``}
    ORDER BY next_air_date, popularity DESC LIMIT ${limit}`;
}

export async function topRated(limit: number, providers: number[] = []) {
  return sql<Card[]>`SELECT ${card()} FROM shows WHERE score IS NOT NULL
      ${providers.length ? sql`AND provider_ids && ${providers}::int[]` : sql``}
    ORDER BY score DESC, popularity DESC LIMIT ${limit}`;
}

export async function providerList() {
  return sql<{ id: number; name: string; logo_path: string | null; count: number }[]>`
    SELECT (p->>'id')::int AS id, min(p->>'name') AS name, min(p->>'logo_path') AS logo_path, count(*)::int AS count
    FROM shows, jsonb_array_elements(providers) p
    GROUP BY 1 HAVING count(*) >= 3 ORDER BY count DESC LIMIT 20`;
}

export async function genreList() {
  return sql<{ genre: string; count: number }[]>`
    SELECT g AS genre, count(*)::int AS count FROM shows, unnest(genres) g GROUP BY g ORDER BY g`;
}

export async function getShow(id: number) {
  const [s] = await sql<Show[]>`SELECT * FROM shows WHERE id = ${id}`;
  return s ?? null;
}

export async function similar(show: Show, limit = 6) {
  return sql<Card[]>`SELECT ${card()} FROM shows
    WHERE id <> ${show.id} AND genres && ${show.genres}::text[]
    ORDER BY cardinality(ARRAY(SELECT unnest(genres) INTERSECT SELECT unnest(${show.genres}::text[]))) DESC,
             score DESC NULLS LAST LIMIT ${limit}`;
}

export async function search(q: string, limit = 40) {
  const like = `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
  return sql<Card[]>`SELECT ${card()} FROM shows
    WHERE name ILIKE ${like} OR original_name ILIKE ${like}
       OR EXISTS (SELECT 1 FROM jsonb_array_elements("cast") c WHERE c->>'name' ILIKE ${like})
       OR EXISTS (SELECT 1 FROM unnest(genres) g WHERE g ILIKE ${like})
    ORDER BY (name ILIKE ${q + "%"}) DESC, popularity DESC LIMIT ${limit}`;
}

export async function followedIds(deviceId: string | null): Promise<Set<number>> {
  if (!deviceId) return new Set();
  const rows = await sql<{ show_id: number }[]>`SELECT show_id FROM follows WHERE device_id = ${deviceId}`;
  return new Set(rows.map((r) => r.show_id));
}

export async function followed(deviceId: string) {
  return sql<Card[]>`SELECT ${card()} FROM shows s JOIN follows f ON f.show_id = s.id
    WHERE f.device_id = ${deviceId} ORDER BY s.next_air_date NULLS LAST, f.created_at DESC`;
}

export async function recommended(deviceId: string | null, limit = 12) {
  if (!deviceId) return topRated(limit);
  return sql<Card[]>`
    WITH g AS (SELECT DISTINCT unnest(s.genres) AS genre FROM follows f JOIN shows s ON s.id = f.show_id WHERE f.device_id = ${deviceId})
    SELECT ${card()} FROM shows
    WHERE id NOT IN (SELECT show_id FROM follows WHERE device_id = ${deviceId})
      AND (NOT EXISTS (SELECT 1 FROM g) OR genres && ARRAY(SELECT genre FROM g))
    ORDER BY score DESC NULLS LAST, popularity DESC LIMIT ${limit}`;
}

export async function myRating(deviceId: string | null, showId: number) {
  if (!deviceId) return null;
  const [r] = await sql<{ value: number }[]>`SELECT value FROM ratings WHERE device_id = ${deviceId} AND show_id = ${showId}`;
  return r?.value ?? null;
}

export async function devicePrefs(deviceId: string | null) {
  const def = { episodes: true, seasons: true };
  if (!deviceId) return def;
  const [r] = await sql<{ prefs: typeof def }[]>`SELECT prefs FROM devices WHERE id = ${deviceId}`;
  return { ...def, ...(r?.prefs ?? {}) };
}

export async function sitemapRows() {
  return sql<{ id: number; slug: string; synced_at: Date }[]>`SELECT id, slug, synced_at FROM shows ORDER BY popularity DESC LIMIT 20000`;
}
