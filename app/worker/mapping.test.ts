import { test } from "node:test";
import assert from "node:assert/strict";
import { mapShow } from "../src/lib/tmdb";
import { parseOmdb } from "../src/lib/omdb";

// Skrátená odpoveď TMDB /tv/{id} s append_to_response (rovnaká štruktúra ako v ich dokumentácii).
const fixture = {
  id: 95396, name: "Oddelenie", original_name: "Severance", overview: "", tagline: "",
  poster_path: "/p.jpg", backdrop_path: "/b.jpg", first_air_date: "2022-02-17", status: "Returning Series",
  genres: [{ id: 18, name: "Dráma" }, { id: 9648, name: "Mysteriózny" }], number_of_seasons: 2, number_of_episodes: 19,
  created_by: [{ name: "Dan Erickson" }], popularity: 312.4, vote_average: 8.4, vote_count: 2100,
  next_episode_to_air: { air_date: "2026-11-24", episode_number: 4, season_number: 3, name: "Nová éra" },
  last_episode_to_air: { air_date: "2026-11-17", episode_number: 3, season_number: 3, name: "" },
  credits: { cast: [{ name: "Britt Lower", character: "Helly R.", profile_path: null, order: 1 }, { name: "Adam Scott", character: "Mark S.", profile_path: "/a.jpg", order: 0 }] },
  "watch/providers": { results: { SK: { link: "https://www.themoviedb.org/tv/95396/watch?locale=SK",
    flatrate: [{ provider_id: 350, provider_name: "Apple TV+", logo_path: "/atv.jpg", display_priority: 5 }],
    ads: [{ provider_id: 350, provider_name: "Apple TV+", logo_path: "/atv.jpg", display_priority: 5 }],
    buy: [{ provider_id: 2, provider_name: "Apple TV", logo_path: "/x.jpg", display_priority: 1 }] } } },
  external_ids: { imdb_id: "tt11280740" },
  videos: { results: [{ site: "YouTube", type: "Teaser", key: "teaser1", iso_639_1: "en" }, { site: "YouTube", type: "Trailer", key: "trail1", iso_639_1: "en", official: true }] },
  translations: { translations: [{ iso_639_1: "cs", data: { name: "Odloučení", overview: "Český popis.", tagline: "" } }, { iso_639_1: "en", data: { overview: "English.", tagline: "Work-life balance" } }] },
};

test("mapShow prevedie odpoveď TMDB", () => {
  const r = mapShow(fixture, "SK");
  assert.equal(r.name, "Oddelenie");
  assert.equal(r.slug, "severance");
  assert.equal(r.overview, "Český popis.");          // sk chýba → cs
  assert.equal(r.tagline, "Work-life balance");      // sk aj cs chýba → en
  assert.deepEqual(r.genres, ["Dráma", "Mysteriózny"]);
  assert.equal(r.year, 2022);
  assert.deepEqual(r.provider_ids, [350]);           // bez duplicít, bez "buy"
  assert.equal(r.providers[0].type, "flatrate");
  assert.equal(r.cast[0].name, "Adam Scott");        // podľa poradia
  assert.deepEqual(r.next_ep, { season: 3, episode: 4, name: "Nová éra", air_date: "2026-11-24" });
  assert.equal(r.next_air_date, "2026-11-24");
  assert.equal(r.trailer_key, "trail1");
  assert.equal(r.imdb_id, "tt11280740");
  assert.equal(r.tmdb_rating, 8.4);
});

test("mapShow zvládne seriál bez platforiem a epizód", () => {
  const r = mapShow({ id: 1, name: "Ľúbostné príbehy", original_name: "Ľúbostné príbehy", vote_count: 0 }, "SK");
  assert.equal(r.slug, "lubostne-pribehy");
  assert.deepEqual(r.providers, []);
  assert.equal(r.next_ep, null);
  assert.equal(r.tmdb_rating, null);
});

test("parseOmdb", () => {
  assert.deepEqual(parseOmdb({ Response: "True", imdbRating: "8.7", imdbVotes: "312,456", Ratings: [{ Source: "Rotten Tomatoes", Value: "96%" }] }),
    { imdb_rating: 8.7, imdb_votes: 312456, rt_rating: 96 });
  assert.deepEqual(parseOmdb({ Response: "True", imdbRating: "N/A", imdbVotes: "N/A", Ratings: [] }),
    { imdb_rating: null, imdb_votes: null, rt_rating: null });
  assert.equal(parseOmdb({ Response: "False", Error: "Incorrect IMDb ID." }), null);
});
