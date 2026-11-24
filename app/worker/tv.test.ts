import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeTitle, normTitle, parseTime, parseXmltv } from "../src/lib/xmltv";
import { pick } from "./tv";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="Markiza.sk"><display-name lang="sk">Markíza</display-name><icon src="https://x/m.png"/></channel>
  <channel id="JOJ.sk"><display-name>JOJ</display-name></channel>
  <programme start="20261124201500 +0100" stop="20261124223000 +0100" channel="Markiza.sk">
    <title lang="en">The Godfather</title><title lang="sk">Krstný otec</title>
    <date>1972</date><category lang="sk">Film</category>
  </programme>
  <programme start="20261124224000 +0100" channel="Markiza.sk">
    <title>Perníkový tatko (12)</title><sub-title>Pád &amp; vzostup</sub-title>
    <episode-num system="xmltv_ns">1.4.0/1</episode-num><category>Seriál</category>
  </programme>
  <programme start="20261124190000 +0100" stop="20261124193000 +0100" channel="JOJ.sk">
    <title>Noviny TV JOJ</title><category>Spravodajstvo</category>
  </programme>
</tv>`;

test("XMLTV: stanice, časy, jazyk názvu, epizóda", () => {
  const x = parseXmltv(XML, ["sk"]);
  assert.equal(x.channels.length, 2);
  assert.deepEqual(x.channels[0], { id: "Markiza.sk", name: "Markíza", icon: "https://x/m.png" });
  const [gf, bb, news] = x.programmes;
  assert.equal(gf.title, "Krstný otec");
  assert.equal(gf.year, 1972);
  assert.equal(gf.start.toISOString(), "2026-11-24T19:15:00.000Z");
  assert.equal(bb.stop, null);
  assert.equal(bb.subTitle, "Pád & vzostup");
  assert.deepEqual([bb.season, bb.episode], [2, 5]);
  assert.ok(looksLikeTitle(gf) && looksLikeTitle(bb));
  assert.ok(!looksLikeTitle(news));
});

test("normalizácia názvov z TV", () => {
  assert.equal(normTitle("Perníkový tatko (12)"), "pernikovy tatko");
  assert.equal(normTitle("Pán prsteňov: Spoločenstvo prsteňa"), "pan prstenov spolocenstvo prstena");
  assert.equal(normTitle("Tom & Jerry"), "tom and jerry");
  assert.equal(parseTime("20260101120000")?.toISOString(), "2026-01-01T12:00:00.000Z");
});

test("výber titulu podľa roku a typu", () => {
  const c = [
    { id: 1, kind: "movie" as const, year: 1972, popularity: 50 },
    { id: 2, kind: "movie" as const, year: 2024, popularity: 90 },
  ];
  assert.equal(pick(c, 1973, false)?.id, 1);
  assert.equal(pick(c, null, false)?.id, 2);
  assert.equal(pick(c, 1990, false), null);
  assert.equal(pick([{ id: 3, kind: "movie", year: 2010, popularity: 99 }, { id: 4, kind: "tv", year: 2010, popularity: 5 }], null, true)?.id, 4);
});

test("tvprogram.cz: časy, rok, film/seriál, po polnoci", async () => {
  const { parseSmsDay, SMS_CHANNELS } = await import("./tvsms");
  const row = (t: string, name: string, detail: string) =>
    `<div class='porad' ><div class='cas'><span style='color: #9E913B'>${t}</span><br /></div><a class='nazev' href='#'><div style='x'>${name}<div class='ztr'></div></div><div class='detail'>${detail} <div class='ztr'></div></div></a></div>`;
  const html = row("20.15", "Krstný otec", "Americký film (1972). Hrajú: M. Brando.") + row("22.40", "Kobra 11 XXV (12)", "Nemecký seriál (2026).") + row("00.30", "Noviny", "Správy");
  const p = parseSmsDay(html, "2026-07-10", SMS_CHANNELS.find((c) => c.id === "markiza")!);
  assert.equal(p.length, 3);
  assert.equal(p[0].start.toISOString(), "2026-07-10T18:15:00.000Z"); // letný čas +2
  assert.deepEqual([p[0].year, p[0].category], [1972, "Film"]);
  assert.deepEqual([p[1].title, p[1].category, p[1].season, p[1].episode, p[1].year], ["Kobra 11 (12)", "Seriál", 25, 12, null]);
  assert.equal(p[2].start.toISOString(), "2026-07-10T22:30:00.000Z"); // 00.30 nasledujúceho dňa
  assert.equal(p[2].category, null);
});
