import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sql } from "../src/lib/db";
import { discoverPage, type Kind } from "../src/lib/tmdb";
import { omdbByImdbId } from "../src/lib/omdb";
import { todayISO } from "../src/lib/format";
import { REGIONS } from "../src/lib/locales";
import { log, markRemoved, pool, syncAllSeasons, syncGenres, syncTitle } from "../src/lib/sync";

export async function migrate() {
  const file = fileURLToPath(new URL("../db/schema.sql", import.meta.url));
  await sql.unsafe(await readFile(file, "utf8"));
  log("Schéma databázy je aktuálna");
}

async function setState(key: string, value: unknown) {
  await sql`INSERT INTO kv (key, value) VALUES (${key}, ${sql.json(value as any)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

async function syncMany(items: { kind: Kind; id: number }[], label: string) {
  let ok = 0, fail = 0;
  await pool(items, 8, async ({ kind, id }) => {
    try {
      await syncTitle(kind, id);
      ok++;
    } catch (e) {
      fail++;
      log(`Chyba pri ${kind} ${id}:`, (e as Error).message);
    }
  });
  log(`${label}: uložených ${ok}, chýb ${fail}`);
  return { ok, fail };
}

/**
 * Nočná úloha: populárne seriály a filmy dostupné v každom regióne,
 * plus všetko, čo už máme na platformách, čo sa sleduje alebo pokračuje.
 */
export async function fullSync() {
  const pages = Number(process.env.SYNC_PAGES ?? 25);       // 20 titulov na stranu
  const moviePages = Number(process.env.SYNC_MOVIE_PAGES ?? pages);
  const want = new Map<string, { kind: Kind; id: number }>();
  const add = (kind: Kind, id: number) => want.set(`${kind}:${id}`, { kind, id });

  await syncGenres().catch((e) => log("Žánre:", e.message));
  for (const region of REGIONS) {
    for (const [kind, max] of [["tv", pages], ["movie", moviePages]] as const) {
      for (let p = 1; p <= max; p++) {
        const res = await discoverPage(kind, region, p);
        res.results.forEach((r) => add(kind, r.id));
        if (p >= res.total_pages) break;
      }
    }
  }
  log(`TMDB discover (${REGIONS.join(", ")}): ${want.size} titulov`);

  const extra = await sql<{ kind: Kind; tmdb_id: number }[]>`
    SELECT kind, tmdb_id FROM titles
    WHERE cardinality(regions) > 0
       OR status IN ('Returning Series', 'In Production', 'Planned', 'Post Production')
       OR id IN (SELECT DISTINCT title_id FROM follows)`;
  extra.forEach((r) => add(r.kind, r.tmdb_id));

  const res = await syncMany([...want.values()], "Nočná synchronizácia");
  await markRemoved();
  await syncFollowedSeasons();
  await syncRatings();
  await setState("last_full_sync", { at: new Date().toISOString(), ...res });
  return res;
}

/** Hodinová úloha: obnoví seriály, ktorým práve vychádza epizóda. */
export async function hourlySync() {
  const rows = await sql<{ kind: Kind; tmdb_id: number }[]>`
    SELECT kind, tmdb_id FROM titles
    WHERE next_air_date <= (${todayISO()}::date + 1)
       OR (id IN (SELECT DISTINCT title_id FROM follows) AND synced_at < now() - interval '12 hours')`;
  if (rows.length) await syncMany(rows.map((r) => ({ kind: r.kind, id: r.tmdb_id })), "Hodinová obnova");
  await syncFollowedSeasons(20);
  await setState("last_hourly_sync", { at: new Date().toISOString() });
}

/** Všetky epizódy sledovaných seriálov (kvôli odškrtávaniu pozretých). Raz za 7 dní. */
export async function syncFollowedSeasons(limit = 200) {
  const rows = await sql<{ id: number }[]>`
    SELECT t.id FROM titles t
    WHERE t.kind = 'tv' AND (t.id IN (SELECT DISTINCT title_id FROM follows) OR t.id IN (SELECT DISTINCT title_id FROM watched WHERE season > 0))
      AND (t.seasons_synced_at IS NULL OR t.seasons_synced_at < now() - interval '7 days')
    ORDER BY t.seasons_synced_at NULLS FIRST LIMIT ${limit}`;
  await pool(rows, 4, async (r) => {
    try { await syncAllSeasons(r.id); } catch (e) { log(`Epizódy titulu ${r.id}:`, (e as Error).message); }
  });
  if (rows.length) log(`Epizódy sledovaných seriálov: ${rows.length}`);
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
    SELECT id, imdb_id FROM titles
    WHERE imdb_id IS NOT NULL AND (omdb_checked_at IS NULL OR omdb_checked_at < now() - interval '7 days')
    ORDER BY omdb_checked_at NULLS FIRST, popularity DESC LIMIT ${left}`;
  let done = 0;
  for (const r of rows) {
    const res = await omdbByImdbId(r.imdb_id).catch((e) => (log("OMDb:", e.message), undefined));
    used++;
    if (res === "limit") break;
    if (res === undefined) continue;
    await sql`UPDATE titles SET omdb_checked_at = now(),
      imdb_rating = ${res?.imdb_rating ?? null}, imdb_votes = ${res?.imdb_votes ?? null}, rt_rating = ${res?.rt_rating ?? null}
      WHERE id = ${r.id}`;
    done++;
  }
  await setState("omdb", { day: today, used });
  log(`OMDb: aktualizovaných ${done} titulov (dnes použitých ${used}/${budgetDay})`);
}

/** Zmaže staré záznamy, ktoré už netreba. */
export async function cleanup() {
  await sql`DELETE FROM transfer_codes WHERE expires_at < now()`;
  await sql`DELETE FROM notifications_sent WHERE sent_at < now() - interval '120 days'`;
  await sql`DELETE FROM devices d WHERE last_seen < now() - interval '400 days'
    AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.device_id = d.id)
    AND (premium_until IS NULL OR premium_until < now())`;
}
