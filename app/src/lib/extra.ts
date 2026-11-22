import { sql } from "./db";
import type { Lang } from "./locales";

/** Epizódy seriálu s názvami v jazyku a informáciou, či ich zariadenie pozrelo. */
export async function episodesFor(titleId: number, lang: Lang, deviceId: string | null) {
  return sql<{ season: number; episode: number; name: string | null; air_date: string | null; watched: boolean }[]>`
    SELECT e.season, e.episode, coalesce(e.names->>${lang}, e.names->>'en') AS name, e.air_date,
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
    JOIN follows f ON f.title_id = e.title_id AND f.device_id = ${deviceId}
    LEFT JOIN watched w ON w.device_id = ${deviceId} AND w.title_id = e.title_id AND w.season = e.season AND w.episode = e.episode
    WHERE e.season > 0 AND e.air_date <= ${today}
    GROUP BY e.title_id
    HAVING count(*) FILTER (WHERE w.device_id IS NOT NULL) > 0`;
}

export async function reviewsFor(titleId: number, deviceId: string | null, limit = 30) {
  return sql<{ id: number; nickname: string | null; body: string; created_at: Date; rating: number | null; mine: boolean; status: string }[]>`
    SELECT r.id, r.nickname, r.body, r.created_at, r.status, rt.value AS rating,
      ${deviceId ? sql`r.device_id = ${deviceId}` : sql`false`} AS mine
    FROM reviews r LEFT JOIN ratings rt ON rt.device_id = r.device_id AND rt.title_id = r.title_id
    WHERE r.title_id = ${titleId} AND (r.status = 'visible' ${deviceId ? sql`OR r.device_id = ${deviceId}` : sql``})
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
