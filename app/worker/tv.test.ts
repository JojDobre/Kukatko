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
