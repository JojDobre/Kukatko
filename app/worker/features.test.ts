import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseImport } from "../src/lib/importers";
import { buildIcal } from "../src/lib/ical";
import { allow } from "../src/lib/ratelimit";
import { cached, clearCache } from "../src/lib/cache";

test("CSV: úvodzovky, čiarky a nové riadky v texte", () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","he said ""hi"""\r\n3,\n'), [["a", "b"], ["x, y", 'he said "hi"'], ["3", ""]]);
});

test("Import IMDb: hodnotenia, typy titulov a watchlist", () => {
  const r = parseImport("ratings.csv", 'Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year\n' +
    'tt0903747,10,2024-01-01,Breaking Bad,Breaking Bad,,TV Series,9.5,49,2008\n' +
    'tt15398776,8,2024-01-01,"Oppenheimer",Oppenheimer,,Movie,8.3,180,2023\n' +
    'tt1234567,7,2024-01-01,Pilot,Pilot,,TV Episode,8,50,2008\n');
  assert.equal(r.source, "imdb");
  assert.deepEqual(r.items.map((i) => [i.action, i.kind, i.value, i.imdb]), [["rate", "tv", 10, "tt0903747"], ["rate", "movie", 8, "tt15398776"]]);
  const w = parseImport("WATCHLIST.csv", "Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year\n1,tt0111161,,,,The Shawshank Redemption,,,movie,9.3,142,1994\n");
  assert.deepEqual(w.items, [{ action: "want", imdb: "tt0111161", kind: "movie", title: "The Shawshank Redemption", year: 1994 }]);
});

test("Import Letterboxd: hviezdičky → 1–10, watchlist a pozreté podľa názvu súboru", () => {
  const head = "Date,Name,Year,Letterboxd URI,Rating\n";
  const r = parseImport("ratings.csv", head + "2024-01-01,Dune: Part Two,2024,https://boxd.it/a,4.5\n2024-01-01,Pelíšky,1999,https://boxd.it/b,0.5\n");
  assert.deepEqual(r.items.map((i) => [i.action, i.value, i.title, i.year]), [["rate", 9, "Dune: Part Two", 2024], ["rate", 1, "Pelíšky", 1999]]);
  assert.equal(parseImport("watchlist.csv", "Date,Name,Year,Letterboxd URI\n2024,Alien,1979,x\n").items[0].action, "want");
  assert.equal(parseImport("watched.csv", "Date,Name,Year,Letterboxd URI\n2024,Alien,1979,x\n").items[0].action, "seen");
});

test("Import Trakt: JSON s id z TMDB a IMDb", () => {
  const r = parseImport("ratings-movies.json", JSON.stringify([
    { rated_at: "2024", rating: 8, type: "movie", movie: { title: "Alien", year: 1979, ids: { tmdb: 348, imdb: "tt0078748" } } },
    { rated_at: "2024", rating: 10, type: "show", show: { title: "Dark", year: 2017, ids: { tmdb: 70523 } } },
    { rated_at: "2024", rating: 7, type: "episode", episode: {} },
  ]));
  assert.equal(r.source, "trakt");
  assert.deepEqual(r.items.map((i) => [i.action, i.kind, i.tmdb, i.value]), [["rate", "movie", 348, 8], ["rate", "tv", 70523, 10]]);
  assert.equal(parseImport("watchlist.json", JSON.stringify([{ listed_at: "x", movie: { title: "Up", ids: { tmdb: 14160 } } }])).items[0].action, "want");
});

test("Import: neznámy formát vyhodí chybu", () => {
  assert.throws(() => parseImport("x.csv", "a,b\n1,2\n"));
});

test("iCal: celodenné udalosti, escapovanie a zalamovanie riadkov", () => {
  const ics = buildIcal("Kukátko", [{ uid: "tv-1-2-3@k", date: "2026-12-31", summary: "Dark S01E01, Geheimnisse; časť 1", url: "https://x.sk/a", description: "Netflix, HBO Max ".repeat(8) }],
    new Date("2026-11-22T10:00:00Z"));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/);
  assert.match(ics, /SUMMARY:Dark S01E01\\, Geheimnisse\; časť 1/);
  assert.ok(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75), "riadok dlhší ako 75 bajtov");
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test("Obmedzenie požiadaviek: pevné okno", () => {
  const t = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(allow("k1", 3, 60, t), true);
  assert.equal(allow("k1", 3, 60, t + 1000), false);
  assert.equal(allow("k1", 3, 60, t + 61_000), true);
  assert.equal(allow("k2", 3, 60, t + 1000), true);
});

test("Cache: rovnaký kľúč spustí dopyt len raz, chyba sa neuloží", async () => {
  clearCache();
  let n = 0;
  const f = () => cached("x", 60, async () => ++n);
  assert.equal(await f(), 1);
  assert.equal(await f(), 1);
  await assert.rejects(cached("err", 60, async () => { throw new Error("db"); }));
  assert.equal(await cached("err", 60, async () => 5), 5);
});

import { mergeSeason } from "../src/lib/tmdb";

test("Epizódy: zlúčenie jazykov, popisy, réžia, scenár a hostia", () => {
  const ep = (o: { name: string; overview: string; episode_number?: number }) => ({ episode_number: 1, air_date: "2026-01-02", runtime: 52, still_path: "/s.jpg", vote_average: 8.4, vote_count: 120,
    crew: [{ job: "Director", name: "A" }, { job: "Writer", name: "B" }, { job: "Teleplay", name: "B" }, { job: "Editor", name: "C" }],
    guest_stars: [{ id: 2, name: "G2", character: "", order: 2 }, { id: 1, name: "G1", character: "Doctor", order: 1, profile_path: "/g.jpg" }], ...o });
  const rows = mergeSeason([
    { lang: "sk", episodes: [ep({ name: "Epizóda 1", overview: "" }), ep({ episode_number: 2, name: "Návrat", overview: "Slovenský popis." })] },
    { lang: "en", episodes: [ep({ name: "Pilot", overview: "English synopsis." }), ep({ episode_number: 2, name: "Return", overview: "EN 2" })] },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].names, { en: "Pilot" });               // „Epizóda 1“ je len náhradný názov, neukladá sa
  assert.deepEqual(rows[0].overviews, { en: "English synopsis." }); // prázdny sk popis sa neukladá
  assert.deepEqual(rows[1].names, { sk: "Návrat", en: "Return" });
  assert.deepEqual(rows[0].directors, ["A"]);
  assert.deepEqual(rows[0].writers, ["B"]);                        // bez duplicít
  assert.deepEqual(rows[0].guests.map((g) => [g.name, g.character]), [["G1", "Doctor"], ["G2", null]]);
  assert.equal(rows[0].tmdb_rating, 8.4);
  assert.equal(rows[0].still_path, "/s.jpg");
});
