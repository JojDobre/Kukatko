import { sql } from "./db";
import { cached, TTL } from "./cache";
import { addDaysISO, todayISO } from "./format";
import type { Lang } from "./locales";
import type { Ep, Kind, Provider, Texts } from "./tmdb";

export type Ctx = { lang: Lang; region: string };

export type Card = {
  id: number; kind: Kind; tmdb_id: number; name: string; slug: string; overview: string | null;
  poster_path: string | null; backdrop_path: string | null; year: number | null; genre_ids: number[]; seasons: number | null;
  providers: Provider[]; next_ep: Ep | null; next_ep_name: string | null; next_air_date: string | null;
  tmdb_rating: number | null; tmdb_votes: number; imdb_rating: number | null; rt_rating: number | null;
  user_avg: number | null; user_count: number; score: number | null;
};

export type TitleFull = {
  id: number; kind: Kind; tmdb_id: number; original_name: string; original_language: string | null;
  i18n: Partial<Record<Lang, Texts>>; poster_path: string | null; backdrop_path: string | null; release_date: string | null;
  year: number | null; status: string | null; genre_ids: number[]; seasons: number | null; episodes: number | null; runtime: number | null;
  creators: string[]; cast: { id: number; name: string; character: string | null; profile_path: string | null }[];
  providers: Record<string, Provider[]>; watch_links: Record<string, string>; trailers: Partial<Record<Lang, string>>;
  next_ep: Ep | null; next_air_date: string | null; last_ep: Ep | null; tmdb_rating: number | null; tmdb_votes: number;
  imdb_id: string | null; imdb_rating: number | null; rt_rating: number | null; user_avg: number | null; user_count: number;
  score: number | null; seasons_synced_at: Date | null;
};

/** Texty titulu v jazyku (s náhradou angličtinou a originálom). */
export function texts(t: Pick<TitleFull, "i18n" | "original_name">, lang: Lang): Texts {
  return t.i18n[lang] ?? t.i18n.en ?? Object.values(t.i18n)[0] ?? { name: t.original_name, overview: null, tagline: null, slug: "titul" };
}

/** Stĺpce pre karty v mriežke, už preložené a s platformami pre región. */
export const card = (c: Ctx) => sql`t.id, t.kind, t.tmdb_id,
  coalesce(t.i18n->${c.lang}->>'name', t.i18n->'en'->>'name', t.original_name) AS name,
  coalesce(t.i18n->${c.lang}->>'slug', t.i18n->'en'->>'slug', 'titul') AS slug,
  coalesce(t.i18n->${c.lang}->>'overview', t.i18n->'en'->>'overview') AS overview,
  t.poster_path, t.backdrop_path, t.year, t.genre_ids, t.seasons, coalesce(t.providers->${c.region}, '[]'::jsonb) AS providers,
  t.next_ep, t.next_air_date, t.tmdb_rating, t.tmdb_votes, t.imdb_rating, t.rt_rating, t.user_avg, t.user_count, t.score,
  (SELECT e.names->>${c.lang} FROM episodes e WHERE e.title_id = t.id
     AND e.season = (t.next_ep->>'season')::int AND e.episode = (t.next_ep->>'episode')::int) AS next_ep_name`;

const inRegion = (c: Ctx) => sql`${c.region} = ANY(t.regions)`;
const onProviders = (c: Ctx, providers: number[]) =>
  providers.length ? sql`AND t.provider_keys && ${providers.map((p) => `${c.region}:${p}`)}::text[]` : sql``;

export const SORTS = {
  score: "t.score DESC NULLS LAST, t.popularity DESC",
  popular: "t.popularity DESC",
  imdb: "t.imdb_rating DESC NULLS LAST, t.imdb_votes DESC NULLS LAST",
  tmdb: "(CASE WHEN t.tmdb_votes >= 20 THEN t.tmdb_rating END) DESC NULLS LAST, t.tmdb_votes DESC",
  rt: "t.rt_rating DESC NULLS LAST, t.popularity DESC",
  users: "(CASE WHEN t.user_count >= 5 THEN t.user_avg END) DESC NULLS LAST, t.user_count DESC",
  next: "t.next_air_date ASC NULLS LAST, t.popularity DESC",
  new: "t.release_date DESC NULLS LAST",
} as const;
export type SortKey = keyof typeof SORTS;
export const isSort = (s: unknown): s is SortKey => typeof s === "string" && s in SORTS;
export const isKind = (s: unknown): s is Kind => s === "tv" || s === "movie";
/** V katalógu môžeme zobraziť aj seriály a filmy spolu. */
export type KindOpt = Kind | "all";
const kindCond = (k: KindOpt) => (k === "all" ? sql`TRUE` : sql`t.kind = ${k}`);

export const PAGE_SIZE = 30;

/** Dĺžka: pri filmoch celý film, pri seriáloch dĺžka epizódy. */
function runtimeOne(kind: Kind, r: "short" | "medium" | "long") {
  const [a, b] = kind === "movie" ? [90, 120] : [30, 60];
  const c = r === "short" ? sql`t.runtime > 0 AND t.runtime < ${a}` : r === "medium" ? sql`t.runtime BETWEEN ${a} AND ${b}` : sql`t.runtime > ${b}`;
  return sql`(t.kind = ${kind} AND ${c})`;
}
function runtimeCond(kind: KindOpt, r: "short" | "medium" | "long") {
  return kind === "all" ? sql`AND (${runtimeOne("tv", r)} OR ${runtimeOne("movie", r)})` : sql`AND ${runtimeOne(kind, r)}`;
}

/** Pôvodné jazyky titulov v regióne (pre filter). */
export function languageList(c: Ctx, kind: KindOpt) {
  return cached(`langs:${c.region}:${kind}`, TTL, () => sql<{ code: string; count: number }[]>`
    SELECT original_language AS code, count(*)::int AS count FROM titles t
    WHERE ${kindCond(kind)} AND ${inRegion(c)} AND original_language IS NOT NULL
    GROUP BY 1 HAVING count(*) >= 3 ORDER BY 2 DESC LIMIT 25`);
}

export function catalog(c: Ctx, o: CatalogOpts) {
  return cached(`cat:${c.lang}:${JSON.stringify(o)}`, TTL, () => catalogRaw(c, o));
}

export type CatalogOpts = {
  kind: KindOpt; sort: SortKey; providers: number[]; genre: number[]; page: number;
  decade?: number | null; runtime?: "short" | "medium" | "long" | null; language?: string | null; minScore?: number | null;
};

async function catalogRaw(c: Ctx, o: CatalogOpts) {
  const sort = o.kind !== "tv" && o.sort === "next" ? "score" : o.sort;
  const cond = sql`${kindCond(o.kind)} AND ${inRegion(c)} ${onProviders(c, o.providers)}
    ${o.genre.length ? sql`AND t.genre_ids && ${o.genre}::int[]` : sql``}
    ${sort === "next" ? sql`AND t.next_air_date >= ${todayISO()}` : sql``}
    ${sort === "new" ? sql`AND t.release_date <= ${todayISO()}` : sql``}
    ${o.decade ? (o.decade < 1980 ? sql`AND t.year < 1980` : sql`AND t.year BETWEEN ${o.decade} AND ${o.decade + 9}`) : sql``}
    ${o.runtime ? runtimeCond(o.kind, o.runtime) : sql``}
    ${o.language ? sql`AND t.original_language = ${o.language}` : sql``}
    ${o.minScore ? sql`AND t.score >= ${o.minScore}` : sql``}`;
  const offset = (Math.max(1, o.page) - 1) * PAGE_SIZE;
  const [rows, [{ count }]] = await Promise.all([
    sql<Card[]>`SELECT ${card(c)} FROM titles t WHERE ${cond} ORDER BY ${sql.unsafe(SORTS[sort])} LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM titles t WHERE ${cond}`,
  ]);
  return { rows, total: count };
}

export function upcoming(c: Ctx, limit: number, providers: number[] = [], ids?: number[], days?: number) {
  const today = todayISO();
  const q = () => sql<Card[]>`SELECT ${card(c)} FROM titles t
    WHERE t.kind = 'tv' AND t.next_air_date >= ${today} AND ${inRegion(c)} ${onProviders(c, providers)}
      ${days != null ? sql`AND t.next_air_date <= ${addDaysISO(today, days)}` : sql``}
      ${ids ? sql`AND t.id = ANY(${ids}::int[])` : sql``}
    ORDER BY t.next_air_date, t.popularity DESC LIMIT ${limit}`;
  return ids ? q() : cached(`up:${c.lang}:${limit}:${providers}:${days}:${today}`, TTL, q);
}

export function topRated(c: Ctx, kind: Kind | null, limit: number, providers: number[] = []) {
  return cached(`top:${c.lang}:${kind}:${limit}:${providers}`, TTL, () => sql<Card[]>`SELECT ${card(c)} FROM titles t
    WHERE t.score IS NOT NULL AND ${inRegion(c)} ${kind ? sql`AND t.kind = ${kind}` : sql``} ${onProviders(c, providers)}
      AND (t.tmdb_votes >= 50 OR t.imdb_votes >= 1000)
    ORDER BY t.score DESC, t.popularity DESC LIMIT ${limit}`);
}

/** Najpopulárnejšie práve teraz (podľa popularity v TMDB). */
export function trending(c: Ctx, kind: Kind | null, limit: number, providers: number[] = []) {
  return cached(`trend:${c.lang}:${kind}:${limit}:${providers}`, TTL, () => sql<Card[]>`SELECT ${card(c)} FROM titles t
    WHERE ${inRegion(c)} ${kind ? sql`AND t.kind = ${kind}` : sql``} ${onProviders(c, providers)}
    ORDER BY t.popularity DESC LIMIT ${limit}`);
}

/** Novinky na platformách (titul sa objavil v posledných dňoch). */
export function newArrivals(c: Ctx, o: { limit: number; providerId?: number; kind?: Kind; days?: number; providers?: number[] }) {
  return cached(`new:${c.lang}:${JSON.stringify(o)}`, TTL, () => sql<(Card & { added: Date; added_provider: number })[]>`
    SELECT ${card(c)}, a.first_seen AS added, a.provider_id AS added_provider FROM (
      SELECT DISTINCT ON (title_id) title_id, first_seen, provider_id FROM availability
      WHERE region = ${c.region} AND NOT initial AND removed_at IS NULL
        AND first_seen > now() - make_interval(days => ${o.days ?? 14})
        ${o.providerId ? sql`AND provider_id = ${o.providerId}` : sql``}
        ${o.providers?.length ? sql`AND provider_id = ANY(${o.providers}::int[])` : sql``}
      ORDER BY title_id, first_seen DESC
    ) a JOIN titles t ON t.id = a.title_id
    ${o.kind ? sql`WHERE t.kind = ${o.kind}` : sql``}
    ORDER BY a.first_seen DESC, t.popularity DESC LIMIT ${o.limit}`);
}

/** Tituly, ktoré nedávno zmizli z platformy. */
export function removedRecently(c: Ctx, limit: number, days = 14, providerId?: number, providers: number[] = []) {
  return cached(`rm:${c.lang}:${limit}:${days}:${providerId}:${providers}`, TTL, () => sql<(Card & { removed: Date; removed_provider: string })[]>`
    SELECT ${card(c)}, a.removed_at AS removed, p.name AS removed_provider FROM (
      SELECT DISTINCT ON (title_id) title_id, removed_at, provider_id FROM availability
      WHERE region = ${c.region} AND removed_at > now() - make_interval(days => ${days})
        ${providerId ? sql`AND provider_id = ${providerId}` : sql``}
        ${providers.length ? sql`AND provider_id = ANY(${providers}::int[])` : sql``}
      ORDER BY title_id, removed_at DESC
    ) a JOIN titles t ON t.id = a.title_id JOIN providers p ON p.id = a.provider_id
    ORDER BY a.removed_at DESC, t.popularity DESC LIMIT ${limit}`);
}

export function providerList(region: string, min = 3) {
  return cached(`prov:${region}:${min}`, TTL, () => sql<{ id: number; name: string; logo_path: string | null; slug: string; count: number }[]>`
    SELECT (p->>'id')::int AS id, min(p->>'name') AS name, min(p->>'logo_path') AS logo_path,
      coalesce(min(pr.slug), min(p->>'name')) AS slug, count(*)::int AS count
    FROM titles t, jsonb_array_elements(t.providers->${region}) p
    LEFT JOIN providers pr ON pr.id = (p->>'id')::int
    GROUP BY 1 HAVING count(*) >= ${min} ORDER BY count DESC LIMIT 20`);
}

/** Žánre v regióne. Pri „všetko“ sa rovnaké názvy zo seriálov a filmov zlúčia (ids = všetky ich id). */
export function genreList(c: Ctx, kind: KindOpt) {
  return cached(`genres:${c.lang}:${kind}`, TTL, () => sql<{ ids: number[]; name: string; count: number }[]>`
    SELECT array_agg(DISTINCT g.id ORDER BY g.id) AS ids, coalesce(gl.name, ge.name, g.id::text) AS name, sum(g.count)::int AS count FROM (
      SELECT t.kind, unnest(t.genre_ids) AS id, count(*)::int AS count FROM titles t WHERE ${kindCond(kind)} AND ${inRegion(c)} GROUP BY 1, 2
    ) g
    LEFT JOIN genres gl ON gl.kind = g.kind AND gl.id = g.id AND gl.lang = ${c.lang}
    LEFT JOIN genres ge ON ge.kind = g.kind AND ge.id = g.id AND ge.lang = 'en'
    GROUP BY 2 ORDER BY 2`);
}

/** Všetky názvy žánrov pre jazyk: kľúč „kind:id“. */
export function genreMap(lang: Lang) {
  return cached(`gmap:${lang}`, TTL, async () => {
    const rows = await sql<{ kind: string; id: number; name: string; lang: string }[]>`
      SELECT kind, id, name, lang FROM genres WHERE lang IN (${lang}, 'en') ORDER BY (lang = ${lang})`;
    const m: Record<string, string> = {};
    for (const r of rows) m[`${r.kind}:${r.id}`] = r.name;
    return m;
  });
}

export async function genreNames(kind: Kind, ids: number[], lang: Lang): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await sql<{ id: number; name: string }[]>`
    SELECT id, name FROM genres WHERE kind = ${kind} AND id = ANY(${ids}::int[]) AND lang IN (${lang}, 'en')
    ORDER BY (lang = ${lang}) DESC`;
  const m = new Map<number, string>();
  for (const r of rows) if (!m.has(r.id)) m.set(r.id, r.name);
  return ids.map((i) => m.get(i)).filter((x): x is string => !!x);
}

export async function getTitle(kind: Kind, tmdbId: number) {
  const [t] = await sql<TitleFull[]>`SELECT * FROM titles WHERE kind = ${kind} AND tmdb_id = ${tmdbId}`;
  return t ?? null;
}

export function similar(t: TitleFull, c: Ctx, limit = 6) {
  return sql<Card[]>`SELECT ${card(c)} FROM titles t
    WHERE t.id <> ${t.id} AND t.kind = ${t.kind} AND t.genre_ids && ${t.genre_ids}::int[] AND ${inRegion(c)}
    ORDER BY cardinality(ARRAY(SELECT unnest(t.genre_ids) INTERSECT SELECT unnest(${t.genre_ids}::int[]))) DESC,
             t.score DESC NULLS LAST LIMIT ${limit}`;
}

const likeOf = (q: string) => `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;

export function search(c: Ctx, q: string, limit = 40) {
  const like = likeOf(q);
  return sql<Card[]>`SELECT ${card(c)} FROM titles t
    WHERE t.original_name ILIKE ${like}
       OR EXISTS (SELECT 1 FROM jsonb_each(t.i18n) x WHERE x.value->>'name' ILIKE ${like})
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(t."cast") cc WHERE cc->>'name' ILIKE ${like})
    ORDER BY (coalesce(t.i18n->${c.lang}->>'name', t.original_name) ILIKE ${q + "%"}) DESC,
             (${c.region} = ANY(t.regions)) DESC, t.popularity DESC LIMIT ${limit}`;
}

export function searchPeople(q: string, limit = 12) {
  return sql<{ id: number; name: string; profile_path: string | null; slug: string | null }[]>`
    SELECT x.id, x.name, x.profile_path, p.slug FROM (
      SELECT DISTINCT ON ((cc->>'id')::int) (cc->>'id')::int AS id, cc->>'name' AS name, cc->>'profile_path' AS profile_path, t.popularity
      FROM titles t, jsonb_array_elements(t."cast") cc
      WHERE cc->>'name' ILIKE ${likeOf(q)} AND cc ? 'id'
      ORDER BY (cc->>'id')::int, t.popularity DESC
    ) x LEFT JOIN people p ON p.id = x.id ORDER BY x.popularity DESC LIMIT ${limit}`;
}

export async function followedIds(deviceId: string | null): Promise<Set<number>> {
  if (!deviceId) return new Set();
  const rows = await sql<{ title_id: number }[]>`SELECT title_id FROM follows WHERE device_id = ${deviceId}`;
  return new Set(rows.map((r) => r.title_id));
}

export function followed(c: Ctx, deviceId: string) {
  return sql<Card[]>`SELECT ${card(c)} FROM titles t JOIN follows f ON f.title_id = t.id
    WHERE f.device_id = ${deviceId} ORDER BY t.next_air_date NULLS LAST, f.created_at DESC`;
}

export function recommended(c: Ctx, deviceId: string | null, limit = 12) {
  if (!deviceId) return topRated(c, null, limit);
  return sql<Card[]>`
    WITH g AS (SELECT DISTINCT unnest(t.genre_ids) AS genre FROM follows f JOIN titles t ON t.id = f.title_id WHERE f.device_id = ${deviceId})
    SELECT ${card(c)} FROM titles t
    WHERE t.id NOT IN (SELECT title_id FROM follows WHERE device_id = ${deviceId})
      AND t.id NOT IN (SELECT title_id FROM hidden WHERE device_id = ${deviceId}) AND ${inRegion(c)}
      AND (t.tmdb_votes >= 50 OR t.imdb_votes >= 1000)
      AND (NOT EXISTS (SELECT 1 FROM g) OR t.genre_ids && ARRAY(SELECT genre FROM g))
    ORDER BY t.score DESC NULLS LAST, t.popularity DESC LIMIT ${limit}`;
}

export async function myRating(deviceId: string | null, titleId: number) {
  if (!deviceId) return null;
  const [r] = await sql<{ value: number }[]>`SELECT value FROM ratings WHERE device_id = ${deviceId} AND title_id = ${titleId}`;
  return r?.value ?? null;
}

export type Prefs = { episodes: boolean; seasons: boolean; availability: boolean; reminder: boolean };
export const DEFAULT_PREFS: Prefs = { episodes: true, seasons: true, availability: true, reminder: true };

export async function deviceInfo(deviceId: string | null) {
  if (!deviceId) return { prefs: DEFAULT_PREFS, premiumUntil: null as Date | null, hasCustomer: false };
  const [r] = await sql<{ prefs: Partial<Prefs>; premium_until: Date | null; stripe_customer: string | null }[]>`
    SELECT prefs, premium_until, stripe_customer FROM devices WHERE id = ${deviceId}`;
  return { prefs: { ...DEFAULT_PREFS, ...(r?.prefs ?? {}) }, premiumUntil: r?.premium_until ?? null, hasCustomer: !!r?.stripe_customer };
}

export function sitemapTitles(lang: Lang, offset: number, limit: number) {
  return sql<{ kind: Kind; tmdb_id: number; slug: string; synced_at: Date }[]>`
    SELECT kind, tmdb_id, coalesce(i18n->${lang}->>'slug', i18n->'en'->>'slug', 'titul') AS slug, synced_at
    FROM titles WHERE cardinality(regions) > 0 ORDER BY popularity DESC OFFSET ${offset} LIMIT ${limit}`;
}

export function sitemapPeople(limit: number) {
  return sql<{ id: number; slug: string; synced_at: Date }[]>`SELECT id, slug, synced_at FROM people ORDER BY popularity DESC LIMIT ${limit}`;
}

/** Karty podľa id (napr. rozpozerané seriály, ktoré užívateľ nesleduje). */
export function cardsByIds(c: Ctx, ids: number[]) {
  if (!ids.length) return Promise.resolve([] as Card[]);
  return sql<Card[]>`SELECT ${card(c)} FROM titles t WHERE t.id = ANY(${ids}::int[])`;
}
