/**
 * Ukážkové dáta na vývoj bez TMDB kľúča (npm run seed:demo).
 * Hodnotenia a dátumy sú vymyslené. Ostrá synchronizácia ich prepíše.
 */
import { sql } from "../src/lib/db";
import { slugify, todayISO } from "../src/lib/format";

const P = {
  netflix: { id: 8, name: "Netflix" }, hbo: { id: 1899, name: "HBO Max" }, disney: { id: 337, name: "Disney Plus" },
  sky: { id: 1773, name: "SkyShowtime" }, voyo: { id: 1789, name: "Voyo" }, prime: { id: 119, name: "Amazon Prime Video" },
  apple: { id: 350, name: "Apple TV+" },
} as const;

type D = [string, number, string[], (keyof typeof P)[], number, number, number | null, number, number | null, string | null, string, string[]];
const DATA: D[] = [
  ["Severance", 2022, ["Thriller", "Sci-Fi & Fantasy"], ["apple"], 8.7, 8.4, 96, 2, 3, "Nová éra v Lumone", "Zamestnanci firmy Lumon podstúpili zákrok, ktorý oddelí pracovné spomienky od súkromných. Keď jeden z nich začne pátrať, čo sa v kancelárii naozaj deje, rozpadá sa celá firma.", ["Adam Scott", "Britt Lower", "Zach Cherry", "John Turturro"]],
  ["The Last of Us", 2023, ["Dráma", "Sci-Fi & Fantasy"], ["hbo"], 8.6, 8.6, 93, 2, null, null, "Dvadsať rokov po pandémii, ktorá zničila civilizáciu, prepašuje Joel štrnásťročnú Ellie cez rozpadnuté Spojené štáty.", ["Pedro Pascal", "Bella Ramsey", "Gabriel Luna"]],
  ["Shōgun", 2024, ["Dráma", "Vojnový"], ["disney"], 8.6, 8.5, 99, 1, 12, "Návrat do Osaky", "Japonsko roku 1600. Lord Toranaga bojuje o prežitie proti rade regentov a do jeho plánov vstúpi anglický moreplavec.", ["Hiroyuki Sanada", "Cosmo Jarvis", "Anna Sawai"]],
  ["Wednesday", 2022, ["Komédia", "Mysteriózny"], ["netflix"], 8.0, 8.5, 72, 2, null, null, "Wednesday Addamsová nastupuje na akadémiu Nevermore, kde vyšetruje sériu vrážd.", ["Jenna Ortega", "Emma Myers", "Gwendoline Christie"]],
  ["The Bear", 2022, ["Dráma", "Komédia"], ["disney"], 8.5, 8.2, 94, 4, 1, "Ranná zmena", "Mladý šéfkuchár z michelinskej reštaurácie sa vráti do Chicaga, aby zachránil rodinný bufet po bratovej smrti.", ["Jeremy Allen White", "Ayo Edebiri", "Ebon Moss-Bachrach"]],
  ["House of the Dragon", 2022, ["Sci-Fi & Fantasy", "Dráma"], ["hbo"], 8.3, 8.4, 85, 2, null, null, "Dvesto rokov pred Hrou o tróny sa rod Targaryenovcov rozdelí v krvavej občianskej vojne.", ["Matt Smith", "Emma D'Arcy", "Olivia Cooke"]],
  ["Slow Horses", 2022, ["Thriller", "Komédia"], ["apple"], 8.1, 8.0, 96, 5, 5, "Spáleniská", "Agenti MI5, ktorí zlyhali, končia v zabudnutej kancelárii Slough House pod vedením cynického Jacksona Lamba.", ["Gary Oldman", "Jack Lowden", "Kristin Scott Thomas"]],
  ["Stranger Things", 2016, ["Sci-Fi & Fantasy", "Mysteriózny"], ["netflix"], 8.7, 8.6, 91, 5, 2, "Posledná kapitola", "V mestečku Hawkins zmizne chlapec a jeho priatelia narazia na tajné vládne experimenty a zvláštne dievča.", ["Millie Bobby Brown", "Finn Wolfhard", "Winona Ryder"]],
  ["Yellowstone", 2018, ["Dráma", "Western"], ["sky"], 8.6, 8.2, 83, 5, null, null, "John Dutton bojuje o najväčší ranč v USA s developermi aj s vlastnou rodinou.", ["Kevin Costner", "Kelly Reilly", "Luke Grimes"]],
  ["Ordinácia v ružovej záhrade", 2007, ["Dráma"], ["voyo"], 5.1, 6.0, null, 20, 4, "Nočná služba", "Lekári a sestry bratislavskej nemocnice riešia náročné prípady na sále aj vzťahy mimo nej.", ["Zdena Studenková", "Kamil Mikulčík", "Petra Polnišová"]],
  ["The Boys", 2019, ["Akčný a dobrodružný", "Komédia"], ["prime"], 8.6, 8.5, 93, 4, 19, "Koniec hry", "Superhrdinovia sú celebrity, ktoré zneužívajú svoju moc. Skupina strážcov sa ich rozhodne zastaviť.", ["Karl Urban", "Jack Quaid", "Antony Starr"]],
  ["Andor", 2022, ["Sci-Fi & Fantasy", "Thriller"], ["disney"], 8.5, 8.3, 96, 2, null, null, "Obyčajný zlodej Cassian Andor sa mení na jednu z kľúčových postáv povstania proti Impériu.", ["Diego Luna", "Stellan Skarsgård", "Genevieve O'Reilly"]],
  ["Dark", 2017, ["Sci-Fi & Fantasy", "Mysteriózny"], ["netflix"], 8.7, 8.4, 95, 3, null, null, "Zmiznutie dvoch detí v nemeckom mestečku odhalí prepojenie štyroch rodín cez tri generácie.", ["Louis Hofmann", "Lisa Vicari", "Oliver Masucci"]],
  ["Halo", 2022, ["Sci-Fi & Fantasy", "Akčný a dobrodružný"], ["sky"], 7.2, 8.0, 70, 2, null, null, "V 26. storočí vedie Master Chief oddiel super-vojakov proti mimozemskej aliancii Covenant.", ["Pablo Schreiber", "Natascha McElhone", "Jen Taylor"]],
];

function addDays(n: number) {
  const d = new Date(todayISO() + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function seedDemo() {
  let i = 0;
  for (const [name, year, genres, plats, imdb, tmdb, rt, seasons, next, epName, overview, cast] of DATA) {
    i++;
    const id = 900000 + i;
    const providers = plats.map((p) => ({ ...P[p], logo_path: null, type: "flatrate" }));
    const nextSeason = next != null ? seasons + (i % 3 === 0 ? 1 : 0) : null;
    const nextEpNum = next != null ? (i % 3 === 0 ? 1 : 3 + (i % 6)) : null;
    const nextEp = next != null ? { season: nextSeason, episode: nextEpNum, name: epName, air_date: addDays(next) } : null;
    const lastEp = next != null && nextEpNum! > 1 ? { season: nextSeason, episode: nextEpNum! - 1, name: "", air_date: addDays(next - 7) } : null;
    const cur = nextEp ? Array.from({ length: 8 }, (_, k) => ({ episode: k + 1, name: k + 1 === nextEpNum ? epName : `Epizóda ${k + 1}`, air_date: addDays(next! + (k + 1 - nextEpNum!) * 7) })) : null;
    await sql`INSERT INTO shows (id, slug, name, original_name, overview, year, first_air_date, status, genres, seasons, creators, "cast",
        providers, provider_ids, next_ep, next_air_date, last_ep, current_season, popularity, tmdb_rating, tmdb_votes,
        imdb_id, imdb_rating, rt_rating, user_avg, user_count)
      VALUES (${id}, ${slugify(name)}, ${name}, ${name}, ${overview}, ${year}, ${year + "-01-15"},
        ${next != null ? "Returning Series" : "Ended"}, ${genres}, ${seasons}, ${[]},
        ${sql.json(cast.map((c) => ({ name: c, character: null, profile_path: null })))},
        ${sql.json(providers)}, ${providers.map((p) => p.id)}, ${nextEp ? sql.json(nextEp) : null}, ${nextEp?.air_date ?? null},
        ${lastEp ? sql.json(lastEp) : null}, ${cur ? sql.json(cur) : null}, ${100 - i * 3}, ${tmdb}, ${500},
        ${"tt" + id}, ${imdb}, ${rt}, ${Math.min(10, imdb + 0.2)}, ${12})
      ON CONFLICT (id) DO NOTHING`;
  }
  console.log(`Vložených ${DATA.length} ukážkových seriálov (id 900001+). Zmažeš ich: DELETE FROM shows WHERE id > 900000;`);
}
