/**
 * Ukladanie dát z TMDB do databázy. Používa robot (worker) aj web
 * (napr. epizódy sa stiahnu hneď po tom, ako začneš seriál sledovať).
 */
import { sql } from "./db";
import { slugify } from "./format";
import { LANGS, REGIONS } from "./locales";
import {
  genreList, mapPerson, mapTitle, personDetails, seasonDetails, titleDetails,
  type Kind, type TitleRow,
} from "./tmdb";

export const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

/** Spustí úlohy s obmedzeným počtom naraz (TMDB povoľuje cca 40 dopytov/s). */
export async function pool<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

export async function upsertTitle(r: TitleRow): Promise<number> {
  const [{ id }] = await sql<{ id: number }[]>`
    INSERT INTO titles (kind, tmdb_id, original_name, original_language, i18n, poster_path, backdrop_path, release_date, year,
      status, genre_ids, seasons, episodes, runtime, creators, "cast", providers, provider_keys, regions, watch_links, trailers,
      next_ep, next_air_date, last_ep, popularity, tmdb_rating, tmdb_votes, imdb_id, synced_at)
    VALUES (${r.kind}, ${r.tmdb_id}, ${r.original_name}, ${r.original_language}, ${sql.json(r.i18n as any)}, ${r.poster_path},
      ${r.backdrop_path}, ${r.release_date}, ${r.year}, ${r.status}, ${r.genre_ids}, ${r.seasons}, ${r.episodes}, ${r.runtime},
      ${r.creators}, ${sql.json(r.cast)}, ${sql.json(r.providers as any)}, ${r.provider_keys}, ${r.regions},
      ${sql.json(r.watch_links)}, ${sql.json(r.trailers as any)}, ${r.next_ep ? sql.json(r.next_ep) : null}, ${r.next_air_date},
      ${r.last_ep ? sql.json(r.last_ep) : null}, ${r.popularity}, ${r.tmdb_rating}, ${r.tmdb_votes}, ${r.imdb_id}, now())
    ON CONFLICT (kind, tmdb_id) DO UPDATE SET
      original_name = EXCLUDED.original_name, original_language = EXCLUDED.original_language,
      i18n = titles.i18n || EXCLUDED.i18n, poster_path = EXCLUDED.poster_path, backdrop_path = EXCLUDED.backdrop_path,
      release_date = EXCLUDED.release_date, year = EXCLUDED.year, status = EXCLUDED.status, genre_ids = EXCLUDED.genre_ids,
      seasons = EXCLUDED.seasons, episodes = EXCLUDED.episodes, runtime = EXCLUDED.runtime, creators = EXCLUDED.creators,
      "cast" = EXCLUDED."cast", providers = EXCLUDED.providers, provider_keys = EXCLUDED.provider_keys, regions = EXCLUDED.regions,
      watch_links = EXCLUDED.watch_links, trailers = EXCLUDED.trailers, next_ep = EXCLUDED.next_ep,
      next_air_date = EXCLUDED.next_air_date, last_ep = EXCLUDED.last_ep, popularity = EXCLUDED.popularity,
      tmdb_rating = EXCLUDED.tmdb_rating, tmdb_votes = EXCLUDED.tmdb_votes,
      imdb_id = COALESCE(EXCLUDED.imdb_id, titles.imdb_id), synced_at = now()
    RETURNING id`;
  await recordAvailability(id, r);
  return id;
}

/**
 * Zapíše, na ktorých platformách je titul práve teraz. Nové objavenie = novinka
 * (okrem úplne prvého stiahnutia titulu). Zmiznutie vyhodnocuje markRemoved().
 */
async function recordAvailability(titleId: number, r: TitleRow) {
  const rows = Object.entries(r.providers).flatMap(([region, list]) => list.map((p) => ({ region, p })));
  for (const { p } of rows) {
    await sql`INSERT INTO providers (id, name, logo_path, slug) VALUES (${p.id}, ${p.name}, ${p.logo_path}, ${slugify(p.name)})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, logo_path = COALESCE(EXCLUDED.logo_path, providers.logo_path)`;
  }
  if (!rows.length) return;
  const [{ known }] = await sql<{ known: boolean }[]>`SELECT EXISTS (SELECT 1 FROM availability WHERE title_id = ${titleId}) AS known`;
  for (const { region, p } of rows) {
    await sql`INSERT INTO availability (title_id, region, provider_id, initial) VALUES (${titleId}, ${region}, ${p.id}, ${!known})
      ON CONFLICT (title_id, region, provider_id) DO UPDATE SET
        last_seen = now(),
        first_seen = CASE WHEN availability.removed_at IS NOT NULL THEN now() ELSE availability.first_seen END,
        initial = CASE WHEN availability.removed_at IS NOT NULL THEN false ELSE availability.initial END,
        removed_at = NULL`;
  }
}

/**
 * Titul berieme ako odstránený z platformy, až keď ho tam nevidíme 36 hodín
 * (aspoň dve synchronizácie). Chráni to pred falošnými upozorneniami, keď TMDB
 * na chvíľu vráti neúplné dáta.
 */
export async function markRemoved() {
  const r = await sql`UPDATE availability a SET removed_at = now()
    FROM titles t
    WHERE t.id = a.title_id AND a.removed_at IS NULL AND a.last_seen < now() - interval '36 hours'
      AND t.synced_at > now() - interval '24 hours' AND a.region = ANY(${REGIONS})`;
  log(`Dostupnosť: ${r.count} titulov zmizlo z platforiem`);
}

/** Stiahne epizódy vybraných sezón vo všetkých zapnutých jazykoch. */
export async function syncSeasons(titleId: number, tmdbId: number, seasons: number[]) {
  for (const season of seasons) {
    const names = new Map<number, { air_date: string | null; runtime: number | null; names: Record<string, string> }>();
    for (const lang of LANGS) {
      try {
        const s = await seasonDetails(tmdbId, season, lang);
        for (const e of s.episodes) {
          const row = names.get(e.episode_number) ?? { air_date: e.air_date || null, runtime: e.runtime ?? null, names: {} };
          // TMDB vracia „Episode 3“ / „Epizoda 3“, keď preklad chýba. Taký názov neukladáme.
          if (e.name && !/^(episode|epizóda|epizoda|odcinek|epizód|folge|rész)\s*\d+$/i.test(e.name.trim())) row.names[lang] = e.name;
          names.set(e.episode_number, row);
        }
      } catch (e: any) {
        if (e?.status === 404) break;
        throw e;
      }
    }
    for (const [episode, v] of names) {
      await sql`INSERT INTO episodes (title_id, season, episode, air_date, runtime, names)
        VALUES (${titleId}, ${season}, ${episode}, ${v.air_date}, ${v.runtime}, ${sql.json(v.names)})
        ON CONFLICT (title_id, season, episode) DO UPDATE SET air_date = EXCLUDED.air_date, runtime = EXCLUDED.runtime,
          names = episodes.names || EXCLUDED.names`;
    }
  }
}

/** Stiahne jeden titul z TMDB a uloží ho. Pri seriáloch aj aktuálnu sezónu. */
export async function syncTitle(kind: Kind, tmdbId: number) {
  const d = await titleDetails(kind, tmdbId);
  const r = mapTitle(kind, d);
  const id = await upsertTitle(r);
  if (kind === "tv") {
    const season = r.next_ep?.season ?? (r.status === "Returning Series" ? r.last_ep?.season : null);
    if (season) await syncSeasons(id, tmdbId, [season]).catch((e) => log(`Sezóna ${season} (${tmdbId}):`, e.message));
  }
  return id;
}

/** Všetky sezóny seriálu (pre sledovanie pozretých epizód). */
export async function syncAllSeasons(titleId: number) {
  const [t] = await sql<{ tmdb_id: number; seasons: number | null; kind: string }[]>`
    SELECT tmdb_id, seasons, kind FROM titles WHERE id = ${titleId}`;
  if (!t || t.kind !== "tv" || !t.seasons) return;
  await syncSeasons(titleId, t.tmdb_id, Array.from({ length: Math.min(t.seasons, 60) }, (_, i) => i + 1));
  await sql`UPDATE titles SET seasons_synced_at = now() WHERE id = ${titleId}`;
}

export async function syncGenres() {
  for (const kind of ["tv", "movie"] as const) {
    for (const lang of LANGS) {
      const { genres } = await genreList(kind, lang);
      for (const g of genres) {
        await sql`INSERT INTO genres (kind, id, lang, name) VALUES (${kind}, ${g.id}, ${lang}, ${g.name})
          ON CONFLICT (kind, id, lang) DO UPDATE SET name = EXCLUDED.name`;
      }
    }
  }
}

/** Herec z cache, prípadne ho stiahne z TMDB (obnova raz za 14 dní). */
export async function ensurePerson(id: number) {
  const [row] = await sql<{ synced_at: Date }[]>`SELECT synced_at FROM people WHERE id = ${id}`;
  if (row && Date.now() - row.synced_at.getTime() < 14 * 864e5) return true;
  try {
    const p = mapPerson(await personDetails(id));
    await sql`INSERT INTO people (id, name, slug, profile_path, birthday, deathday, birthplace, known_for, bio, credits, popularity, synced_at)
      VALUES (${p.id}, ${p.name}, ${p.slug}, ${p.profile_path}, ${p.birthday}, ${p.deathday}, ${p.birthplace}, ${p.known_for},
        ${sql.json(p.bio as any)}, ${sql.json(p.credits)}, ${p.popularity}, now())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, profile_path = EXCLUDED.profile_path,
        birthday = EXCLUDED.birthday, deathday = EXCLUDED.deathday, birthplace = EXCLUDED.birthplace, known_for = EXCLUDED.known_for,
        bio = EXCLUDED.bio, credits = EXCLUDED.credits, popularity = EXCLUDED.popularity, synced_at = now()`;
    return true;
  } catch (e: any) {
    if (!row) log(`Herec ${id}:`, e.message);
    return !!row;
  }
}

