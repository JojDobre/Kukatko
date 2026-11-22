import { sql } from "./db";
import type { Lang } from "./locales";

/** Skóre epizódy v %: užívatelia (od 3 hodnotení), inak TMDB (od 5 hlasov). */
export const episodeScore = () => sql`round(CASE WHEN e.user_count >= 3 THEN e.user_avg * 10 WHEN e.tmdb_votes >= 5 THEN e.tmdb_rating * 10 END)::int`;

/** Epizódy seriálu s názvami v jazyku a informáciou, či ich zariadenie pozrelo. */
export async function episodesFor(titleId: number, lang: Lang, deviceId: string | null) {
  return sql<{ season: number; episode: number; name: string | null; air_date: string | null; watched: boolean; still_path: string | null; score: number | null }[]>`
    SELECT e.season, e.episode, coalesce(e.names->>${lang}, e.names->>'en') AS name, e.air_date, e.still_path,
      ${episodeScore()} AS score,
      ${deviceId ? sql`EXISTS (SELECT 1 FROM watched w WHERE w.device_id = ${deviceId} AND w.title_id = e.title_id AND w.season = e.season AND w.episode = e.episode)` : sql`false`} AS watched
    FROM episodes e WHERE e.title_id = ${titleId} AND e.season > 0 ORDER BY e.season, e.episode`;
}

/** Rozpozeraté seriály: koľko je pozretých z vydaných a čo je na rade. */
export async function inProgress(deviceId: string, lang: Lang, today: string) {
  return sql<{ title_id: number; watched: number; aired: number; next_season: number | null; next_episode: number | null; next_name: string | null }[]>`
    SELECT e.title_id,
      count(*) FILTER (WHERE w.device_id IS NOT NULL)::int AS watched,
      count(*)::int AS aired,
      (array_agg(e.season ORDER BY e.season, e.episode) FILTER (WHERE w.device_id IS NULL))[1] AS next_season,
      (array_agg(e.episode ORDER BY e.season, e.episode) FILTER (WHERE w.device_id IS NULL))[1] AS next_episode,
      (array_agg(coalesce(e.names->>${lang}, e.names->>'en') ORDER BY e.season, e.episode) FILTER (WHERE w.device_id IS NULL))[1] AS next_name
    FROM episodes e
    LEFT JOIN watched w ON w.device_id = ${deviceId} AND w.title_id = e.title_id AND w.season = e.season AND w.episode = e.episode
    WHERE e.season > 0 AND e.air_date <= ${today}
      AND e.title_id IN (SELECT DISTINCT title_id FROM watched WHERE device_id = ${deviceId} AND season > 0)
    GROUP BY e.title_id
    HAVING count(*) FILTER (WHERE w.device_id IS NOT NULL) > 0`;
}

export async function reviewsFor(titleId: number, deviceId: string | null, limit = 30, season = 0, episode = 0) {
  return sql<{ id: number; nickname: string | null; body: string; created_at: Date; rating: number | null; mine: boolean; status: string }[]>`
    SELECT r.id, r.nickname, r.body, r.created_at, r.status, rt.value AS rating,
      ${deviceId ? sql`r.device_id = ${deviceId}` : sql`false`} AS mine
    FROM reviews r
    LEFT JOIN ${season ? sql`episode_ratings rt ON rt.device_id = r.device_id AND rt.title_id = r.title_id AND rt.season = r.season AND rt.episode = r.episode`
      : sql`ratings rt ON rt.device_id = r.device_id AND rt.title_id = r.title_id`}
    WHERE r.title_id = ${titleId} AND r.season = ${season} AND r.episode = ${episode}
      AND (r.status = 'visible' ${deviceId ? sql`OR r.device_id = ${deviceId}` : sql``})
    ORDER BY r.created_at DESC LIMIT ${limit}`;
}

/** Hrubé slová a odkazy: takú recenziu najprv skontroluje človek. */
const BAD = [
  "kurv", "piča", "pica", "pici", "jeb", "kokot", "debil", "zmrd", "čurák", "curak", "hovno", "sráč", "srac", "buzer", "cigán", "cigan",
  "fuck", "shit", "cunt", "bitch", "nigg", "fag", "kurwa", "chuj", "pierdol", "szar", "kurva", "geci", "picsa", "fasz", "scheiß", "scheiss", "fotze", "hurensohn", "wichser",
];
export function needsModeration(text: string) {
  const t = text.toLowerCase();
  return /https?:\/\/|www\.|\.(com|sk|cz|net|ru)\b/.test(t) || BAD.some((w) => t.includes(w));
}

export type EpisodeFull = {
  title_id: number; season: number; episode: number; air_date: string | null; runtime: number | null;
  names: Record<string, string>; overviews: Record<string, string>; still_path: string | null;
  tmdb_rating: number | null; tmdb_votes: number; directors: string[]; writers: string[];
  guests: { id: number; name: string; character: string | null; profile_path: string | null }[];
  user_avg: number | null; user_count: number;
};

export async function getEpisode(titleId: number, season: number, episode: number) {
  const [e] = await sql<EpisodeFull[]>`SELECT * FROM episodes WHERE title_id = ${titleId} AND season = ${season} AND episode = ${episode}`;
  return e ?? null;
}

/** Predchádzajúca a ďalšia epizóda (aj cez hranicu sezóny). */
export async function episodeNeighbors(titleId: number, season: number, episode: number) {
  const [prev] = await sql<{ season: number; episode: number }[]>`SELECT season, episode FROM episodes
    WHERE title_id = ${titleId} AND season > 0 AND (season, episode) < (${season}, ${episode}) ORDER BY season DESC, episode DESC LIMIT 1`;
  const [next] = await sql<{ season: number; episode: number }[]>`SELECT season, episode FROM episodes
    WHERE title_id = ${titleId} AND season > 0 AND (season, episode) > (${season}, ${episode}) ORDER BY season, episode LIMIT 1`;
  return { prev: prev ?? null, next: next ?? null };
}

export async function myEpisodeState(deviceId: string | null, titleId: number, season: number, episode: number) {
  if (!deviceId) return { rating: null as number | null, watched: false };
  const [r] = await sql<{ rating: number | null; watched: boolean }[]>`SELECT
    (SELECT value FROM episode_ratings WHERE device_id = ${deviceId} AND title_id = ${titleId} AND season = ${season} AND episode = ${episode}) AS rating,
    EXISTS (SELECT 1 FROM watched WHERE device_id = ${deviceId} AND title_id = ${titleId} AND season = ${season} AND episode = ${episode}) AS watched`;
  return r;
}

/** Epizódy na mapu stránok (len populárnejšie seriály, kde máme epizódy). */
export function sitemapEpisodes(lang: string, limit: number) {
  return sql<{ tmdb_id: number; slug: string; season: number; episode: number }[]>`
    SELECT t.tmdb_id, coalesce(t.i18n->${lang}->>'slug', t.i18n->'en'->>'slug', 'titul') AS slug, e.season, e.episode
    FROM episodes e JOIN titles t ON t.id = e.title_id
    WHERE e.season > 0 AND e.air_date <= current_date AND cardinality(t.regions) > 0
    ORDER BY t.popularity DESC, e.season, e.episode LIMIT ${limit}`;
}
