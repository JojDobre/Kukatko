/** Dopyty pre osobné funkcie: Chcem vidieť, skryté, štatistiky, výber na dnes, spolu, kalendár. */
import { sql } from "./db";
import { addDaysISO, todayISO } from "./format";
import { card, type Card, type Ctx } from "./queries";
import type { Kind } from "./tmdb";

export async function idSet(table: "want" | "hidden", deviceId: string | null): Promise<Set<number>> {
  if (!deviceId) return new Set();
  const rows = table === "want"
    ? await sql<{ title_id: number }[]>`SELECT title_id FROM want WHERE device_id = ${deviceId}`
    : await sql<{ title_id: number }[]>`SELECT title_id FROM hidden WHERE device_id = ${deviceId}`;
  return new Set(rows.map((r) => r.title_id));
}

export function wantList(c: Ctx, deviceId: string) {
  return sql<Card[]>`SELECT ${card(c)} FROM titles t JOIN want w ON w.title_id = t.id
    WHERE w.device_id = ${deviceId} ORDER BY (${c.region} = ANY(t.regions)) DESC, w.created_at DESC`;
}

export function hiddenList(c: Ctx, deviceId: string) {
  return sql<Card[]>`SELECT ${card(c)} FROM titles t JOIN hidden h ON h.title_id = t.id
    WHERE h.device_id = ${deviceId} ORDER BY h.created_at DESC LIMIT 60`;
}

/** Pozreté filmy (uložené ako season = 0, episode = 0). */
export async function movieSeen(deviceId: string | null, titleId: number) {
  if (!deviceId) return false;
  const r = await sql`SELECT 1 FROM watched WHERE device_id = ${deviceId} AND title_id = ${titleId} AND season = 0 AND episode = 0`;
  return r.length > 0;
}

/* ---------- Čo dnes pozrieť ---------- */

/** Nálady → žánre TMDB (seriály a filmy majú čiastočne iné id). */
export const MOODS: Record<string, { tv: number[]; movie: number[] }> = {
  relax: { tv: [35, 10764, 10767], movie: [35] },
  tense: { tv: [80, 9648], movie: [53, 80, 9648] },
  think: { tv: [18, 99], movie: [18, 99, 36] },
  action: { tv: [10759, 10765, 10768], movie: [28, 12, 878] },
  romance: { tv: [18, 10766], movie: [10749] },
  scary: { tv: [9648, 10765], movie: [27] },
  family: { tv: [10751, 16, 10762], movie: [10751, 16] },
  surprise: { tv: [], movie: [] },
};
export const TIMES = { short: 60, medium: 120, long: 0 } as const;

export async function pick(c: Ctx, o: { mood: string; kind: Kind | "any"; time: keyof typeof TIMES; providers: number[]; deviceId: string | null; seed: number }) {
  const m = MOODS[o.mood] ?? MOODS.surprise;
  const kinds: Kind[] = o.kind === "any" ? ["tv", "movie"] : [o.kind];
  const max = TIMES[o.time] ?? 0;
  const conds = kinds.map((k) => {
    const g = k === "tv" ? m.tv : m.movie;
    // Pri seriáli rozhoduje dĺžka epizódy; pri „celom večeri“ bez obmedzenia.
    const time = max ? sql`AND (t.runtime IS NULL OR t.runtime <= ${max})` : sql``;
    return sql`(t.kind = ${k} ${g.length ? sql`AND t.genre_ids && ${g}::int[]` : sql``} ${time})`;
  }).reduce((a, b) => sql`${a} OR ${b}`);
  const dev = o.deviceId;
  return sql<Card[]>`
    SELECT ${card(c)} FROM titles t
    WHERE ${c.region} = ANY(t.regions) AND (${conds}) AND t.score >= 65 AND (t.tmdb_votes >= 100 OR t.imdb_votes >= 5000)
      ${o.providers.length ? sql`AND t.provider_keys && ${o.providers.map((p) => `${c.region}:${p}`)}::text[]` : sql``}
      ${dev ? sql`AND t.id NOT IN (SELECT title_id FROM hidden WHERE device_id = ${dev})
        AND t.id NOT IN (SELECT title_id FROM ratings WHERE device_id = ${dev})
        AND t.id NOT IN (SELECT title_id FROM watched WHERE device_id = ${dev})` : sql``}
    ORDER BY md5(t.id::text || ${String(o.seed)}) LIMIT 40`.then((rows) => {
    // Z náhodných 40 vezmeme 12 najlepšie hodnotených a z nich náhodne 3: tipy sú pestré, ale kvalitné.
    const top = rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 12);
    const key = (id: number) => ((id * 2654435761) ^ o.seed) >>> 0;
    return top.sort((a, b) => key(a.id) - key(b.id)).slice(0, 3);
  });
}

/* ---------- Kalendár ---------- */

export type CalItem = { date: string; title_id: number; kind: Kind; tmdb_id: number; name: string; slug: string; poster_path: string | null;
  season: number; episode: number; ep_name: string | null; providers: { id: number; name: string }[]; followed: boolean };

export function calendar(c: Ctx, from: string, to: string, deviceId: string | null, providers: number[], onlyMine: boolean) {
  return sql<CalItem[]>`
    SELECT e.air_date AS date, t.id AS title_id, t.kind, t.tmdb_id,
      coalesce(t.i18n->${c.lang}->>'name', t.i18n->'en'->>'name', t.original_name) AS name,
      coalesce(t.i18n->${c.lang}->>'slug', t.i18n->'en'->>'slug', 'titul') AS slug, t.poster_path,
      e.season, e.episode, coalesce(e.names->>${c.lang}, e.names->>'en') AS ep_name,
      coalesce(t.providers->${c.region}, '[]'::jsonb) AS providers,
      ${deviceId ? sql`EXISTS (SELECT 1 FROM follows f WHERE f.device_id = ${deviceId} AND f.title_id = t.id)` : sql`false`} AS followed
    FROM episodes e JOIN titles t ON t.id = e.title_id
    WHERE e.air_date BETWEEN ${from} AND ${to} AND e.season > 0 AND ${c.region} = ANY(t.regions)
      ${providers.length ? sql`AND t.provider_keys && ${providers.map((p) => `${c.region}:${p}`)}::text[]` : sql``}
      ${onlyMine && deviceId ? sql`AND t.id IN (SELECT title_id FROM follows WHERE device_id = ${deviceId})` : sql``}
    ORDER BY e.air_date, t.popularity DESC, e.episode
    LIMIT 1500`;
}

/** Epizódy sledovaných seriálov pre kalendár v telefóne (iCal). */
export function icalEpisodes(deviceId: string, lang: string) {
  const today = todayISO();
  return sql<{ date: string; name: string; season: number; episode: number; ep_name: string | null; kind: string; tmdb_id: number; slug: string; providers: string | null }[]>`
    SELECT e.air_date AS date, coalesce(t.i18n->${lang}->>'name', t.i18n->'en'->>'name', t.original_name) AS name,
      e.season, e.episode, coalesce(e.names->>${lang}, e.names->>'en') AS ep_name, t.kind, t.tmdb_id,
      coalesce(t.i18n->${lang}->>'slug', t.i18n->'en'->>'slug', 'titul') AS slug,
      (SELECT string_agg(p->>'name', ', ') FROM jsonb_array_elements(t.providers->d.region) p) AS providers
    FROM follows f JOIN devices d ON d.id = f.device_id JOIN titles t ON t.id = f.title_id JOIN episodes e ON e.title_id = t.id
    WHERE f.device_id = ${deviceId} AND e.season > 0 AND e.air_date BETWEEN ${addDaysISO(today, -30)} AND ${addDaysISO(today, 180)}
    ORDER BY e.air_date LIMIT 2000`;
}

/* ---------- Štatistiky ---------- */

export async function stats(deviceId: string, lang: string, year?: number) {
  const yr = year ? sql`AND extract(year FROM w.created_at) = ${year}` : sql``;
  const [[tot], genres, top, months] = await Promise.all([
    sql<{ minutes: number; episodes: number; movies: number; rated: number }[]>`
      SELECT coalesce(sum(CASE WHEN w.season = 0 THEN coalesce(t.runtime, 100) ELSE coalesce(e.runtime, t.runtime, 45) END), 0)::int AS minutes,
        count(*) FILTER (WHERE w.season > 0)::int AS episodes, count(*) FILTER (WHERE w.season = 0)::int AS movies,
        (SELECT count(*)::int FROM ratings WHERE device_id = ${deviceId}) AS rated
      FROM watched w JOIN titles t ON t.id = w.title_id
      LEFT JOIN episodes e ON e.title_id = w.title_id AND e.season = w.season AND e.episode = w.episode
      WHERE w.device_id = ${deviceId} ${yr}`,
    sql<{ kind: Kind; id: number; name: string; n: number }[]>`
      SELECT x.kind, x.id, coalesce(gl.name, ge.name, x.id::text) AS name, x.n FROM (
        SELECT t.kind, unnest(t.genre_ids) AS id, count(*)::int AS n FROM (
          SELECT DISTINCT title_id FROM watched w WHERE w.device_id = ${deviceId} ${yr}
          UNION SELECT title_id FROM ratings WHERE device_id = ${deviceId}
        ) u JOIN titles t ON t.id = u.title_id GROUP BY 1, 2
      ) x
      LEFT JOIN genres gl ON gl.kind = x.kind AND gl.id = x.id AND gl.lang = ${lang}
      LEFT JOIN genres ge ON ge.kind = x.kind AND ge.id = x.id AND ge.lang = 'en'
      ORDER BY x.n DESC LIMIT 6`,
    sql<{ id: number; kind: Kind; tmdb_id: number; name: string; slug: string; poster_path: string | null; value: number }[]>`
      SELECT t.id, t.kind, t.tmdb_id, coalesce(t.i18n->${lang}->>'name', t.i18n->'en'->>'name', t.original_name) AS name,
        coalesce(t.i18n->${lang}->>'slug', t.i18n->'en'->>'slug', 'titul') AS slug, t.poster_path, r.value
      FROM ratings r JOIN titles t ON t.id = r.title_id WHERE r.device_id = ${deviceId}
      ${year ? sql`AND extract(year FROM r.created_at) = ${year}` : sql``}
      ORDER BY r.value DESC, t.popularity DESC LIMIT 5`,
    sql<{ month: number; n: number }[]>`
      SELECT extract(month FROM w.created_at)::int AS month, count(*)::int AS n FROM watched w
      WHERE w.device_id = ${deviceId} AND extract(year FROM w.created_at) = ${year ?? new Date().getFullYear()}
      GROUP BY 1 ORDER BY 1`,
  ]);
  // Rovnaký žáner môže byť pri seriáloch aj filmoch (napr. Dráma): zlúčime podľa názvu.
  const g = new Map<string, number>();
  for (const x of genres) g.set(x.name, (g.get(x.name) ?? 0) + x.n);
  return { ...tot, hours: Math.round(tot.minutes / 6) / 10, genres: [...g].sort((a, b) => b[1] - a[1]).slice(0, 5), top, months };
}

/* ---------- Pozerajte spolu ---------- */

export async function togetherMatches(c: Ctx, a: string, b: string, limit = 24) {
  const [pa, pb] = await Promise.all([a, b].map(async (id) => {
    const [r] = await sql<{ platforms: Record<string, number[]> }[]>`SELECT platforms FROM devices WHERE id = ${id}`;
    return r?.platforms?.[c.region] ?? [];
  }));
  // Platformy: ak majú obaja vybrané, berieme tituly, ktoré sú aspoň na jednej z ich platforiem.
  const provs = [...new Set([...pa, ...pb])];
  const seen = sql`SELECT title_id FROM watched WHERE device_id IN (${a}, ${b})
    UNION SELECT title_id FROM ratings WHERE device_id IN (${a}, ${b})
    UNION SELECT title_id FROM hidden WHERE device_id IN (${a}, ${b})`;
  return sql<(Card & { wants: number })[]>`
    SELECT ${card(c)}, (SELECT count(*)::int FROM want w WHERE w.title_id = t.id AND w.device_id IN (${a}, ${b})) AS wants
    FROM titles t
    WHERE ${c.region} = ANY(t.regions) AND t.id NOT IN (${seen})
      ${provs.length ? sql`AND t.provider_keys && ${provs.map((p) => `${c.region}:${p}`)}::text[]` : sql``}
      AND (t.id IN (SELECT title_id FROM want WHERE device_id IN (${a}, ${b}))
           OR (t.score >= 75 AND (t.tmdb_votes >= 200 OR t.imdb_votes >= 10000)))
    ORDER BY wants DESC, t.score DESC NULLS LAST, t.popularity DESC LIMIT ${limit}`;
}

/** Uloží platformy zariadenia (z cookie) aj do databázy, aby ich poznal robot. */
export async function savePlatforms(deviceId: string, region: string, ids: number[]) {
  await sql`UPDATE devices SET platforms = platforms || ${sql.json({ [region]: ids })} WHERE id = ${deviceId}`;
}
