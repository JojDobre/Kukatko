import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mapPerson, mapTitle } from "../src/lib/tmdb";
import { parseOmdb } from "../src/lib/omdb";
import { verifyWebhook } from "../src/lib/stripe";
import { needsModeration } from "../src/lib/extra";
import { plural, dict, fmt } from "../src/lib/i18n";
import sk from "../src/lib/i18n/sk";
import cs from "../src/lib/i18n/cs";
import en from "../src/lib/i18n/en";
import pl from "../src/lib/i18n/pl";
import hu from "../src/lib/i18n/hu";
import de from "../src/lib/i18n/de";

// Skrátená odpoveď TMDB /tv/{id}?language=en-US&append_to_response=… (štruktúra podľa dokumentácie TMDB).
const tv = {
  id: 95396, name: "Severance", original_name: "Severance", original_language: "en", overview: "English overview.", tagline: "",
  poster_path: "/p.jpg", backdrop_path: "/b.jpg", first_air_date: "2022-02-17", status: "Returning Series",
  genres: [{ id: 18, name: "Drama" }, { id: 9648, name: "Mystery" }], number_of_seasons: 2, number_of_episodes: 19, episode_run_time: [55],
  created_by: [{ name: "Dan Erickson" }], popularity: 312.4, vote_average: 8.4, vote_count: 2100,
  next_episode_to_air: { air_date: "2026-11-24", episode_number: 4, season_number: 3, name: "Nová éra" },
  last_episode_to_air: { air_date: "2026-11-17", episode_number: 3, season_number: 3, name: "" },
  credits: { cast: [{ id: 2, name: "Britt Lower", character: "Helly R.", profile_path: null, order: 1 }, { id: 1, name: "Adam Scott", character: "Mark S.", profile_path: "/a.jpg", order: 0 }] },
  "watch/providers": { results: {
    SK: { link: "https://www.themoviedb.org/tv/95396/watch?locale=SK",
      flatrate: [{ provider_id: 350, provider_name: "Apple TV+", logo_path: "/atv.jpg", display_priority: 5 }],
      ads: [{ provider_id: 350, provider_name: "Apple TV+", logo_path: "/atv.jpg", display_priority: 5 }],
      buy: [{ provider_id: 2, provider_name: "Apple TV", logo_path: "/x.jpg", display_priority: 1 }] },
    CZ: { link: "https://www.themoviedb.org/tv/95396/watch?locale=CZ", flatrate: [{ provider_id: 350, provider_name: "Apple TV+", logo_path: "/atv.jpg", display_priority: 5 }] },
    US: { flatrate: [{ provider_id: 9, provider_name: "Prime", display_priority: 1 }] },
  } },
  external_ids: { imdb_id: "tt11280740" },
  videos: { results: [{ site: "YouTube", type: "Teaser", key: "teaser1", iso_639_1: "en" }, { site: "YouTube", type: "Trailer", key: "trail1", iso_639_1: "en", official: true }, { site: "YouTube", type: "Trailer", key: "csTrailer", iso_639_1: "cs" }] },
  translations: { translations: [
    { iso_639_1: "cs", iso_3166_1: "CZ", data: { name: "Odloučení", overview: "Český popis.", tagline: "" } },
    { iso_639_1: "sk", iso_3166_1: "SK", data: { name: "", overview: "", tagline: "" } },
    { iso_639_1: "en", iso_3166_1: "US", data: { name: "Severance", overview: "English overview.", tagline: "Work-life balance" } },
    { iso_639_1: "de", iso_3166_1: "DE", data: { name: "Severance", overview: "Deutsche Beschreibung.", tagline: "" } },
  ] },
};

test("mapTitle: seriál, preklady a platformy pre viac krajín", () => {
  const r = mapTitle("tv", tv, ["sk", "cs", "en", "de"], ["SK", "CZ", "GB"]);
  assert.equal(r.kind, "tv");
  assert.equal(r.i18n.cs?.name, "Odloučení");              // lokálny názov
  assert.equal(r.i18n.sk?.name, "Severance");              // sk preklad chýba → originál
  assert.equal(r.i18n.sk?.overview, "Český popis.");       // sk popis chýba → čeština
  assert.equal(r.i18n.de?.overview, "Deutsche Beschreibung.");
  assert.equal(r.i18n.en?.tagline, "Work-life balance");
  assert.equal(r.i18n.cs?.slug, "odlouceni");
  assert.deepEqual(r.genre_ids, [18, 9648]);
  assert.deepEqual(r.providers.SK.map((p) => p.id), [350]); // bez duplicít a bez „kúpiť“
  assert.ok(r.providers.CZ && !r.providers.GB);
  assert.deepEqual(r.provider_keys.sort(), ["CZ:350", "GLOBAL:350", "SK:350"]);
  assert.deepEqual(r.regions.sort(), ["CZ", "GLOBAL", "SK"]);
  assert.equal(r.trailers.cs, "csTrailer");
  assert.equal(r.trailers.sk, "trail1");                   // bez sk traileru → anglický oficiálny
  assert.equal(r.cast[0].name, "Adam Scott");
  assert.equal(r.cast[0].id, 1);
  assert.deepEqual(r.next_ep, { season: 3, episode: 4, name: "Nová éra", air_date: "2026-11-24" });
  assert.equal(r.runtime, 55);
  assert.equal(r.imdb_id, "tt11280740");
});

test("mapTitle: film (réžia, dĺžka, dátum premiéry)", () => {
  const m = mapTitle("movie", {
    id: 872585, title: "Oppenheimer", original_title: "Oppenheimer", original_language: "en", release_date: "2023-07-19",
    runtime: 181, imdb_id: "tt15398776", vote_count: 9000, vote_average: 8.1, genres: [{ id: 18 }],
    credits: { cast: [], crew: [{ job: "Director", name: "Christopher Nolan" }, { job: "Writer", name: "X" }] },
    translations: { translations: [{ iso_639_1: "pl", iso_3166_1: "PL", data: { title: "Oppenheimer", overview: "Polski opis." } }] },
  }, ["sk", "pl"], ["SK"]);
  assert.equal(m.kind, "movie");
  assert.equal(m.year, 2023);
  assert.equal(m.runtime, 181);
  assert.deepEqual(m.creators, ["Christopher Nolan"]);
  assert.equal(m.i18n.pl?.overview, "Polski opis.");
  assert.equal(m.next_ep, null);
  assert.equal(m.seasons, null);
});

test("mapTitle: titul bez platforiem a s diakritikou v slugu", () => {
  const r = mapTitle("tv", { id: 1, name: "Ľúbostné príbehy", original_name: "Ľúbostné príbehy", original_language: "sk", vote_count: 0 }, ["sk"], ["SK"]);
  assert.equal(r.i18n.sk?.slug, "lubostne-pribehy");
  assert.deepEqual(r.providers, {});
  assert.equal(r.tmdb_rating, null);
});

test("mapPerson: životopis s náhradou a filmografia bez duplicít", () => {
  const p = mapPerson({ id: 5, name: "Zdena Studenková", biography: "English bio", known_for_department: "Acting", place_of_birth: "Bratislava",
    translations: { translations: [{ iso_639_1: "sk", data: { biography: "Slovenský životopis" } }] },
    combined_credits: { cast: [
      { media_type: "tv", id: 10, name: "Ordinácia", first_air_date: "2007-01-01", popularity: 5, character: "Dr." },
      { media_type: "tv", id: 10, name: "Ordinácia", first_air_date: "2007-01-01", popularity: 5 },
      { media_type: "movie", id: 11, title: "Film", release_date: "1990-01-01", popularity: 9 },
    ], crew: [] } }, ["sk", "cs", "en"]);
  assert.equal(p.bio.sk, "Slovenský životopis");
  assert.equal(p.bio.cs, "Slovenský životopis"); // cs → sk
  assert.equal(p.bio.en, "English bio");
  assert.equal(p.credits.length, 2);
  assert.equal(p.credits[0].kind, "movie");      // podľa popularity
  assert.equal(p.slug, "zdena-studenkova");
});

test("parseOmdb", () => {
  assert.deepEqual(parseOmdb({ Response: "True", imdbRating: "8.7", imdbVotes: "312,456", Ratings: [{ Source: "Rotten Tomatoes", Value: "96%" }] }),
    { imdb_rating: 8.7, imdb_votes: 312456, rt_rating: 96 });
  assert.equal(parseOmdb({ Response: "False", Error: "Incorrect IMDb ID." }), null);
});

test("Stripe: overenie podpisu webhooku", () => {
  const secret = "whsec_test", body = '{"id":"evt_1"}', t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.equal(verifyWebhook(body, `t=${t},v1=${sig}`, secret), true);
  assert.equal(verifyWebhook(body + " ", `t=${t},v1=${sig}`, secret), false);
  assert.equal(verifyWebhook(body, `t=${t - 1000},v1=${createHmac("sha256", secret).update(`${t - 1000}.${body}`).digest("hex")}`, secret), false);
  assert.equal(verifyWebhook(body, null, secret), false);
});

test("Moderácia recenzií", () => {
  assert.equal(needsModeration("Skvelý seriál, odporúčam každému fanúšikovi sci-fi."), false);
  assert.equal(needsModeration("Pozri si to na www.niekde.com zadarmo"), true);
  assert.equal(needsModeration("Toto je úplná kurva hlúposť"), true);
});

test("Skloňovanie podľa jazyka", () => {
  assert.equal(plural(sk.time.inDays, 1, "sk"), "o 1 deň");
  assert.equal(plural(sk.time.inDays, 3, "sk"), "o 3 dni");
  assert.equal(plural(sk.time.inDays, 5, "sk"), "o 5 dní");
  assert.equal(plural(pl.common.seasons, 22, "pl"), "22 sezony");
  assert.equal(plural(pl.common.seasons, 25, "pl"), "25 sezonów");
  assert.equal(plural(en.common.seasons, 1, "en"), "1 season");
  assert.equal(fmt(dict("de").notify.epTitle, { name: "Dark" }), "Dark: neue Folge");
});

test("Preklady majú všetky kľúče", () => {
  const keys = (o: any, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  const base = keys(sk).sort();
  for (const [name, d] of Object.entries({ cs, en, pl, hu, de })) assert.deepEqual(keys(d).sort(), base, `chýbajú kľúče v ${name}`);
});
