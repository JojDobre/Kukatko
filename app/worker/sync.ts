import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sql } from "../src/lib/db";
import { discoverPage, mapShow, seasonDetails, showDetails, type ShowRow } from "../src/lib/tmdb";
import { omdbByImdbId } from "../src/lib/omdb";
import { todayISO } from "../src/lib/format";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

export async function migrate() {
  const file = fileURLToPath(new URL("../db/schema.sql", import.meta.url));
  await sql.unsafe(await readFile(file, "utf8"));
  log("Schéma databázy je aktuálna");
}

/** Spustí úlohy s obmedzeným počtom naraz (TMDB povoľuje cca 40 dopytov/s). */
async function pool<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

async function upsert(r: ShowRow, currentSeason: unknown) {
  await sql`
    INSERT INTO shows (id, slug, name, original_name, overview, tagline, poster_path, backdrop_path, first_air_date, year,
      status, genres, seasons, episodes, creators, "cast", providers, provider_ids, watch_link, next_ep, next_air_date,
      last_ep, current_season, trailer_key, popularity, tmdb_rating, tmdb_votes, imdb_id, synced_at)
    VALUES (${r.id}, ${r.slug}, ${r.name}, ${r.original_name}, ${r.overview}, ${r.tagline}, ${r.poster_path},
      ${r.backdrop_path}, ${r.first_air_date}, ${r.year}, ${r.status}, ${r.genres}, ${r.seasons}, ${r.episodes},
      ${r.creators}, ${sql.json(r.cast)}, ${sql.json(r.providers)}, ${r.provider_ids}, ${r.watch_link},
      ${r.next_ep ? sql.json(r.next_ep) : null}, ${r.next_air_date}, ${r.last_ep ? sql.json(r.last_ep) : null},
      ${currentSeason ? sql.json(currentSeason as any) : null}, ${r.trailer_key}, ${r.popularity}, ${r.tmdb_rating},
      ${r.tmdb_votes}, ${r.imdb_id}, now())
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug, name = EXCLUDED.name, original_name = EXCLUDED.original_name, overview = EXCLUDED.overview,
      tagline = EXCLUDED.tagline, poster_path = EXCLUDED.poster_path, backdrop_path = EXCLUDED.backdrop_path,
      first_air_date = EXCLUDED.first_air_date, year = EXCLUDED.year, status = EXCLUDED.status, genres = EXCLUDED.genres,
      seasons = EXCLUDED.seasons, episodes = EXCLUDED.episodes, creators = EXCLUDED.creators, "cast" = EXCLUDED."cast",
      providers = EXCLUDED.providers, provider_ids = EXCLUDED.provider_ids, watch_link = EXCLUDED.watch_link,
      next_ep = EXCLUDED.next_ep, next_air_date = EXCLUDED.next_air_date, last_ep = EXCLUDED.last_ep,
      current_season = EXCLUDED.current_season, trailer_key = EXCLUDED.trailer_key, popularity = EXCLUDED.popularity,
      tmdb_rating = EXCLUDED.tmdb_rating, tmdb_votes = EXCLUDED.tmdb_votes,
      imdb_id = COALESCE(EXCLUDED.imdb_id, shows.imdb_id), synced_at = now()`;
}

/** Stiahne jeden seriál z TMDB a uloží ho. */
export async function syncShow(id: number) {
  const d = await showDetails(id);
  const r = mapShow(d);
  let currentSeason = null;
  const season = r.next_ep?.season ?? (r.status === "Returning Series" ? r.last_ep?.season : null);
  if (season) {
    try {
      const s = await seasonDetails(id, season);
      currentSeason = s.episodes.map((e) => ({ episode: e.episode_number, name: e.name, air_date: e.air_date || null }));
    } catch (e) {
      log(`Sezónu ${season} seriálu ${id} sa nepodarilo načítať:`, (e as Error).message);
    }
  }
  await upsert(r, currentSeason);
}

async function syncMany(ids: number[], label: string) {
  let ok = 0, fail = 0;
  await pool(ids, 8, async (id) => {
    try {
      await syncShow(id);
      ok++;
    } catch (e) {
      fail++;
      log(`Chyba pri seriáli ${id}:`, (e as Error).message);
    }
  });
  log(`${label}: uložených ${ok}, chýb ${fail}`);
}

/** Nočná úloha: populárne seriály dostupné v regióne + všetky sledované a pokračujúce. */
export async function fullSync() {
  const pages = Number(process.env.SYNC_PAGES ?? 25); // 20 seriálov na stranu
  const ids = new Set<number>();
  for (let p = 1; p <= pages; p++) {
    const res = await discoverPage(p);
    res.results.forEach((r) => ids.add(r.id));
    if (p >= res.total_pages) break;
  }
  log(`TMDB discover: ${ids.size} seriálov`);
  const extra = await sql<{ id: number }[]>`
    SELECT id FROM shows WHERE status IN ('Returning Series', 'In Production', 'Planned')
    UNION SELECT DISTINCT show_id FROM follows`;
  extra.forEach((r) => ids.add(r.id));
  await syncMany([...ids], "Nočná synchronizácia");
  await syncRatings();
}

/** Hodinová úloha: obnoví seriály, ktorým práve vychádza epizóda (aby sme vedeli poslať upozornenie). */
export async function hourlySync() {
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM shows
    WHERE next_air_date <= (${todayISO()}::date + 1)
       OR (id IN (SELECT DISTINCT show_id FROM follows) AND synced_at < now() - interval '12 hours')`;
  if (rows.length) await syncMany(rows.map((r) => r.id), "Hodinová obnova");
}

/** Hodnotenia z OMDb v rámci denného limitu. Najprv tie, ktoré nemáme vôbec alebo najdlhšie. */
export async function syncRatings() {
  if (!process.env.OMDB_API_KEY) return log("OMDB_API_KEY nie je nastavený, hodnotenia IMDb/RT preskakujem");
  const today = todayISO();
  const budgetDay = Number(process.env.OMDB_DAILY_LIMIT ?? 900);
  const [state] = await sql<{ value: { day: string; used: number } }[]>`SELECT value FROM kv WHERE key = 'omdb'`;
  let used = state?.value.day === today ? state.value.used : 0;
  const left = budgetDay - used;
  if (left <= 0) return log("OMDb: denný limit vyčerpaný");

  const rows = await sql<{ id: number; imdb_id: string }[]>`
    SELECT id, imdb_id FROM shows
    WHERE imdb_id IS NOT NULL AND (omdb_checked_at IS NULL OR omdb_checked_at < now() - interval '7 days')
    ORDER BY omdb_checked_at NULLS FIRST, popularity DESC LIMIT ${left}`;
  let done = 0;
  for (const r of rows) {
    const res = await omdbByImdbId(r.imdb_id).catch((e) => (log("OMDb:", e.message), undefined));
    used++;
    if (res === "limit") break;
    if (res === undefined) continue;
    await sql`UPDATE shows SET omdb_checked_at = now(),
      imdb_rating = ${res?.imdb_rating ?? null}, imdb_votes = ${res?.imdb_votes ?? null}, rt_rating = ${res?.rt_rating ?? null}
      WHERE id = ${r.id}`;
    done++;
  }
  await sql`INSERT INTO kv (key, value) VALUES ('omdb', ${sql.json({ day: today, used })})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  log(`OMDb: aktualizovaných ${done} seriálov (dnes použitých ${used}/${budgetDay})`);
}
