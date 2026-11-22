/**
 * Ukážkové dáta na vývoj bez TMDB kľúča (npm run seed:demo).
 * Hodnotenia, dátumy a platformy sú vymyslené. Na ostrom serveri nespúšťať.
 * Zmažeš ich: DELETE FROM titles WHERE tmdb_id > 900000;
 */
import { sql } from "../src/lib/db";
import { addDaysISO, slugify, todayISO } from "../src/lib/format";
import { LANGS, REGIONS } from "../src/lib/locales";
import { upsertTitle } from "../src/lib/sync";
import type { TitleRow } from "../src/lib/tmdb";

const P = {
  netflix: { id: 8, name: "Netflix" }, hbo: { id: 1899, name: "HBO Max" }, disney: { id: 337, name: "Disney Plus" },
  sky: { id: 1773, name: "SkyShowtime" }, voyo: { id: 1789, name: "Voyo" }, prime: { id: 119, name: "Amazon Prime Video" },
  apple: { id: 350, name: "Apple TV+" },
} as const;
type PK = keyof typeof P;

// [názov, rok, žánre TMDB, platformy, imdb, tmdb, rt, sezóny, ďalšia epizóda o X dní, popis, herci]
type Tv = [string, number, number[], PK[], number, number, number | null, number, number | null, string, string[]];
const TV: Tv[] = [
  ["Severance", 2022, [18, 9648, 10765], ["apple"], 8.7, 8.4, 96, 2, 3, "Zamestnanci firmy Lumon podstúpili zákrok, ktorý oddelí pracovné spomienky od súkromných.", ["Adam Scott", "Britt Lower", "Zach Cherry"]],
  ["The Last of Us", 2023, [18, 10765], ["hbo"], 8.6, 8.6, 93, 2, null, "Dvadsať rokov po pandémii prepašuje Joel štrnásťročnú Ellie cez rozpadnuté Spojené štáty.", ["Pedro Pascal", "Bella Ramsey"]],
  ["Shōgun", 2024, [18, 10768], ["disney"], 8.6, 8.5, 99, 1, 12, "Japonsko roku 1600. Lord Toranaga bojuje o prežitie proti rade regentov.", ["Hiroyuki Sanada", "Anna Sawai"]],
  ["Wednesday", 2022, [35, 9648], ["netflix"], 8.0, 8.5, 72, 2, null, "Wednesday Addamsová nastupuje na akadémiu Nevermore a vyšetruje sériu vrážd.", ["Jenna Ortega", "Emma Myers"]],
  ["The Bear", 2022, [18, 35], ["disney"], 8.5, 8.2, 94, 4, 1, "Mladý šéfkuchár sa vráti do Chicaga, aby zachránil rodinný bufet.", ["Jeremy Allen White", "Ayo Edebiri"]],
  ["Slow Horses", 2022, [80, 18], ["apple"], 8.1, 8.0, 96, 5, 5, "Agenti MI5, ktorí zlyhali, končia v zabudnutej kancelárii Slough House.", ["Gary Oldman", "Jack Lowden"]],
  ["Stranger Things", 2016, [10765, 9648], ["netflix"], 8.7, 8.6, 91, 5, 2, "V mestečku Hawkins zmizne chlapec a jeho priatelia narazia na tajné experimenty.", ["Millie Bobby Brown", "Winona Ryder"]],
  ["Ordinácia v ružovej záhrade", 2007, [18], ["voyo"], 5.1, 6.0, null, 20, 4, "Lekári a sestry bratislavskej nemocnice riešia náročné prípady.", ["Zdena Studenková", "Kamil Mikulčík"]],
  ["The Boys", 2019, [10759, 35], ["prime"], 8.6, 8.5, 93, 4, 19, "Superhrdinovia zneužívajú svoju moc. Skupina strážcov sa ich rozhodne zastaviť.", ["Karl Urban", "Jack Quaid"]],
  ["Dark", 2017, [10765, 9648], ["netflix"], 8.7, 8.4, 95, 3, null, "Zmiznutie dvoch detí odhalí prepojenie štyroch rodín cez tri generácie.", ["Louis Hofmann", "Lisa Vicari"]],
];
// [názov, rok, žánre, platformy, imdb, tmdb, rt, minúty, popis, réžia, herci]
type Mv = [string, number, number[], PK[], number, number, number | null, number, string, string, string[]];
const MOVIES: Mv[] = [
  ["Oppenheimer", 2023, [18, 36], ["prime"], 8.3, 8.1, 93, 180, "Príbeh fyzika J. Roberta Oppenheimera a vývoja atómovej bomby.", "Christopher Nolan", ["Cillian Murphy", "Emily Blunt"]],
  ["Dune: Part Two", 2024, [878, 12], ["hbo"], 8.5, 8.2, 92, 167, "Paul Atreides sa spojí s Fremenmi a hľadá pomstu.", "Denis Villeneuve", ["Timothée Chalamet", "Zendaya"]],
  ["Barbie", 2023, [35, 12], ["hbo"], 6.8, 7.0, 88, 114, "Barbie a Ken opustia Barbieland a objavia skutočný svet.", "Greta Gerwig", ["Margot Robbie", "Ryan Gosling"]],
  ["Inside Out 2", 2024, [16, 10751], ["disney"], 7.6, 7.6, 91, 96, "V hlave dospievajúcej Riley pribudnú nové emócie.", "Kelsey Mann", ["Amy Poehler", "Maya Hawke"]],
  ["Pelíšky", 1999, [35, 18], ["voyo"], 8.3, 8.0, null, 115, "Vianoce 1967 v dvoch rodinách, ktoré žijú v jednom dome.", "Jan Hřebejk", ["Jiří Kodet", "Miroslav Donutil"]],
  ["Poor Things", 2023, [878, 10749], ["disney"], 7.8, 7.7, 92, 141, "Mladá žena oživená výstredným vedcom spoznáva svet.", "Yorgos Lanthimos", ["Emma Stone", "Mark Ruffalo"]],
];

const providersFor = (plats: PK[]) => {
  const list = plats.map((p) => ({ ...P[p], logo_path: null, type: "flatrate" }));
  return Object.fromEntries(REGIONS.map((r) => [r, list]));
};

function i18n(name: string, overview: string) {
  const out: TitleRow["i18n"] = {};
  for (const l of LANGS) out[l] = { name, overview: l === "sk" || l === "cs" ? overview : `Demo: ${overview}`, tagline: null, slug: slugify(name) };
  return out;
}

export async function seedDemo() {
  const today = todayISO();
  const ids: number[] = [];
  let n = 0;
  for (const [name, year, genres, plats, imdb, tmdb, rt, seasons, next, overview, cast] of TV) {
    n++;
    const providers = providersFor(plats);
    const nextSeason = next != null ? seasons + (n % 3 === 0 ? 1 : 0) : null;
    const nextEpNum = next != null ? (n % 3 === 0 ? 1 : 3 + (n % 5)) : null;
    const nextEp = next != null ? { season: nextSeason!, episode: nextEpNum!, name: "", air_date: addDaysISO(today, next) } : null;
    const lastEp = nextEp && nextEp.episode > 1 ? { season: nextEp.season, episode: nextEp.episode - 1, name: "", air_date: addDaysISO(today, next! - 7) } : null;
    const row: TitleRow = {
      kind: "tv", tmdb_id: 900000 + n, original_name: name, original_language: "en", i18n: i18n(name, overview),
      poster_path: null, backdrop_path: null, release_date: `${year}-01-15`, year, status: next != null ? "Returning Series" : "Ended",
      genre_ids: genres, seasons: nextSeason ?? seasons, episodes: seasons * 8, runtime: 50, creators: [],
      cast: cast.map((c, i) => ({ id: 990000 + n * 10 + i, name: c, character: null, profile_path: null })),
      providers, provider_keys: Object.entries(providers).flatMap(([r, l]) => l.map((p) => `${r}:${p.id}`)), regions: Object.keys(providers),
      watch_links: {}, trailers: {}, next_ep: nextEp, next_air_date: nextEp?.air_date ?? null, last_ep: lastEp,
      popularity: 100 - n * 3, tmdb_rating: tmdb, tmdb_votes: 500, imdb_id: `tt${900000 + n}`,
    };
    const id = await upsertTitle(row);
    ids.push(id);
    await sql`UPDATE titles SET imdb_rating = ${imdb}, rt_rating = ${rt}, user_avg = ${Math.min(10, imdb + 0.2)}, user_count = 12,
      seasons_synced_at = now() WHERE id = ${id}`;
    // Epizódy: posledné tri sezóny po 8 dieloch.
    const lastSeason = nextSeason ?? seasons;
    for (let s = Math.max(1, lastSeason - 2); s <= lastSeason; s++) {
      for (let e = 1; e <= 8; e++) {
        const offset = nextEp && s === nextEp.season ? next! + (e - nextEp.episode) * 7 : -((lastSeason - s + 1) * 400) + e * 7;
        await sql`INSERT INTO episodes (title_id, season, episode, air_date, runtime, names)
          VALUES (${id}, ${s}, ${e}, ${addDaysISO(today, offset)}, 50, ${sql.json({ sk: `Epizóda ${e}`, en: `Episode ${e}` })})
          ON CONFLICT DO NOTHING`;
      }
    }
  }
  n = 0;
  for (const [name, year, genres, plats, imdb, tmdb, rt, runtime, overview, director, cast] of MOVIES) {
    n++;
    const providers = providersFor(plats);
    const row: TitleRow = {
      kind: "movie", tmdb_id: 900100 + n, original_name: name, original_language: name === "Pelíšky" ? "cs" : "en", i18n: i18n(name, overview),
      poster_path: null, backdrop_path: null, release_date: `${year}-07-01`, year, status: "Released", genre_ids: genres,
      seasons: null, episodes: null, runtime, creators: [director],
      cast: cast.map((c, i) => ({ id: 991000 + n * 10 + i, name: c, character: null, profile_path: null })),
      providers, provider_keys: Object.entries(providers).flatMap(([r, l]) => l.map((p) => `${r}:${p.id}`)), regions: Object.keys(providers),
      watch_links: {}, trailers: {}, next_ep: null, next_air_date: null, last_ep: null,
      popularity: 90 - n * 4, tmdb_rating: tmdb, tmdb_votes: 800, imdb_id: `tt${900100 + n}`,
    };
    const id = await upsertTitle(row);
    ids.push(id);
    await sql`UPDATE titles SET imdb_rating = ${imdb}, rt_rating = ${rt}, user_avg = ${Math.min(10, imdb)}, user_count = 8 WHERE id = ${id}`;
  }
  // Simulované zmeny dostupnosti, aby rebríčky „Nové“ a „Zmizlo“ neboli prázdne.
  await sql`UPDATE availability SET initial = false, first_seen = now() - (random() * interval '10 days')
    WHERE title_id = ANY(${ids.slice(0, 4).concat(ids.slice(-3))}::int[])`;
  await sql`INSERT INTO availability (title_id, region, provider_id, first_seen, last_seen, removed_at, initial)
    SELECT id, r, 8, now() - interval '200 days', now() - interval '3 days', now() - interval '2 days', true
    FROM titles, unnest(${REGIONS}::text[]) r WHERE id = ANY(${[ids[1], ids[ids.length - 2]]}::int[])
    ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO genres (kind, id, lang, name) SELECT * FROM (VALUES
    ('tv', 18, 'sk', 'Dráma'), ('tv', 9648, 'sk', 'Mysteriózny'), ('tv', 10765, 'sk', 'Sci-fi a fantasy'), ('tv', 35, 'sk', 'Komédia'),
    ('tv', 80, 'sk', 'Krimi'), ('tv', 10759, 'sk', 'Akčný a dobrodružný'), ('tv', 10768, 'sk', 'Vojnový a politický'),
    ('movie', 18, 'sk', 'Dráma'), ('movie', 36, 'sk', 'Historický'), ('movie', 878, 'sk', 'Sci-fi'), ('movie', 12, 'sk', 'Dobrodružný'),
    ('movie', 35, 'sk', 'Komédia'), ('movie', 16, 'sk', 'Animovaný'), ('movie', 10751, 'sk', 'Rodinný'), ('movie', 10749, 'sk', 'Romantický'),
    ('tv', 18, 'en', 'Drama'), ('tv', 35, 'en', 'Comedy'), ('movie', 18, 'en', 'Drama'), ('movie', 35, 'en', 'Comedy')
  ) v ON CONFLICT DO NOTHING`;
  console.log(`Vložených ${TV.length} ukážkových seriálov a ${MOVIES.length} filmov. Zmažeš ich: DELETE FROM titles WHERE tmdb_id > 900000;`);
}
