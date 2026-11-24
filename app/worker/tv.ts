/**
 * TV program: stiahne XMLTV pre každú krajinu (premenná TV_XMLTV_SK, TV_XMLTV_CZ…),
 * uloží relácie, ktoré vyzerajú ako film/seriál, a spáruje ich s titulmi v katalógu
 * (podľa názvu a roku, prípadne cez vyhľadávanie v TMDB).
 */
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { sql } from "../src/lib/db";
import { ALL_LOCALES, LANGS, REGIONS } from "../src/lib/locales";
import { log, syncTitle } from "../src/lib/sync";
import { tmdb, type Kind } from "../src/lib/tmdb";
import { looksLikeTitle, normTitle, parseXmltv, type XProgramme } from "../src/lib/xmltv";

const list = (v: string | undefined) => (v ?? "").split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
const langsFor = (region: string) => {
  const own = LANGS.filter((l) => ALL_LOCALES[l].region === region);
  return own.length ? own.flatMap((l) => [l, ...ALL_LOCALES[l].fallback]) : ["en"];
};
const tmdbLang = (region: string) => {
  const l = LANGS.find((x) => ALL_LOCALES[x].region === region);
  return l ? ALL_LOCALES[l].tmdb : "en-US";
};

/** Stiahne súbor (URL alebo cesta na disku), rozbalí .gz a prečíta v kódovaní z hlavičky XML. */
async function load(src: string): Promise<string> {
  let buf: Buffer;
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src, { headers: { "User-Agent": "Kukatko-TV/1.0" }, signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`${src}: HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } else buf = await readFile(src);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const enc = buf.subarray(0, 200).toString("latin1").match(/encoding=["']([\w-]+)["']/i)?.[1] ?? "utf-8";
  try { return new TextDecoder(enc).decode(buf); } catch { return buf.toString("utf8"); }
}

type Cand = { id: number; kind: Kind; year: number | null; popularity: number };

/** Index názvov z katalógu: normalizovaný názov (v každom jazyku aj originál) → tituly. */
async function nameIndex() {
  const rows = await sql<(Cand & { names: string[] | null; original_name: string })[]>`
    SELECT id, kind, year, popularity, original_name,
      (SELECT array_agg(DISTINCT v->>'name') FROM jsonb_each(i18n) AS e(k, v) WHERE v->>'name' IS NOT NULL) AS names
    FROM titles`;
  const idx = new Map<string, Cand[]>();
  for (const r of rows) {
    for (const n of new Set([r.original_name, ...(r.names ?? [])].map(normTitle))) {
      if (!n) continue;
      const a = idx.get(n) ?? [];
      a.push({ id: r.id, kind: r.kind, year: r.year, popularity: r.popularity });
      idx.set(n, a);
    }
  }
  return idx;
}

/** Vyberie titul z kandidátov podľa roku a typu (pri zhode roku ±1). */
export function pick(cands: Cand[] | undefined, year: number | null, series: boolean): Cand | null {
  if (!cands?.length) return null;
  let c = cands;
  if (year) {
    const y = c.filter((x) => x.year && Math.abs(x.year - year) <= 1);
    if (y.length) c = y;
    else if (c.every((x) => x.year)) return null; // iný film s rovnakým názvom
  }
  if (series) { const tv = c.filter((x) => x.kind === "tv"); if (tv.length) c = tv; }
  return [...c].sort((a, b) => b.popularity - a.popularity)[0];
}

type Row = {
  region: string; channel_id: string; starts_at: Date; ends_at: Date | null; title: string; sub_title: string | null;
  year: number | null; category: string | null; season: number | null; episode: number | null; norm: string;
};

async function importRegion(region: string, idx: Map<string, Cand[]>) {
  const sources = list(process.env[`TV_XMLTV_${region}`]);
  const allow = list(process.env[`TV_CHANNELS_${region}`]).map((s) => s.toLowerCase());
  const days = Number(process.env.TV_DAYS ?? 8);
  const from = Date.now() - 86400_000, to = Date.now() + days * 86400_000;
  let channels = 0, airings = 0;
  for (const src of sources) {
    const x = parseXmltv(await load(src), langsFor(region));
    const ok = new Set(x.channels.filter((c) => !allow.length || allow.includes(c.id.toLowerCase()) || allow.includes(c.name.toLowerCase())).map((c) => c.id));
    const chans = x.channels.filter((c) => ok.has(c.id));
    if (chans.length) {
      await sql`INSERT INTO tv_channels ${sql(chans.map((c) => ({ region, id: c.id, name: c.name, icon: c.icon })), "region", "id", "name", "icon")}
        ON CONFLICT (region, id) DO UPDATE SET name = EXCLUDED.name, icon = coalesce(EXCLUDED.icon, tv_channels.icon), updated_at = now()`;
      channels += chans.length;
    }
    // Koniec relácie, ak chýba: začiatok ďalšej na tej istej stanici.
    const byCh = new Map<string, XProgramme[]>();
    for (const p of x.programmes) if (ok.has(p.channel)) (byCh.get(p.channel) ?? byCh.set(p.channel, []).get(p.channel)!).push(p);
    const rows: Row[] = [];
    for (const [ch, ps] of byCh) {
      ps.sort((a, b) => +a.start - +b.start);
      ps.forEach((p, i) => {
        const stop = p.stop ?? ps[i + 1]?.start ?? null;
        if (+p.start > to || +(stop ?? p.start) < from) return;
        const norm = normTitle(p.title);
        if (!norm || (!looksLikeTitle(p) && !idx.has(norm))) return; // správy, šport, reklama…
        rows.push({ region, channel_id: ch, starts_at: p.start, ends_at: stop, title: p.title.slice(0, 300), sub_title: p.subTitle?.slice(0, 300) ?? null,
          year: p.year, category: p.category?.slice(0, 200) ?? null, season: p.season, episode: p.episode, norm });
      });
    }
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000);
      await sql`INSERT INTO tv_airings ${sql(chunk, "region", "channel_id", "starts_at", "ends_at", "title", "sub_title", "year", "category", "season", "episode", "norm")}
        ON CONFLICT (region, channel_id, starts_at) DO UPDATE SET ends_at = EXCLUDED.ends_at, title = EXCLUDED.title, sub_title = EXCLUDED.sub_title,
          year = EXCLUDED.year, category = EXCLUDED.category, season = EXCLUDED.season, episode = EXCLUDED.episode, norm = EXCLUDED.norm,
          title_id = CASE WHEN tv_airings.norm = EXCLUDED.norm THEN tv_airings.title_id END`;
    }
    airings += rows.length;
  }
  return { channels, airings };
}

/** Vyhľadá názov z TV v TMDB a pridá nájdený titul do katalógu. */
async function searchTmdb(title: string, norm: string, year: number | null, series: boolean, region: string): Promise<number | null> {
  const res = await tmdb<{ results: any[] }>("/search/multi", { query: title, language: tmdbLang(region), include_adult: "false" });
  const hits = res.results.filter((r) => r.media_type === "tv" || r.media_type === "movie").slice(0, 10).filter((r) =>
    [r.title, r.name, r.original_title, r.original_name].filter(Boolean).some((n: string) => normTitle(n) === norm));
  const cands: Cand[] = hits.map((r) => ({
    id: r.id, kind: r.media_type, popularity: r.popularity ?? 0,
    year: Number(String(r.release_date ?? r.first_air_date ?? "").slice(0, 4)) || null,
  }));
  const best = pick(cands, year, series);
  return best ? syncTitle(best.kind, best.id) : null;
}

/** Spáruje relácie bez titulu: najprv katalóg, potom pamäť minulých pokusov, nakoniec TMDB (s limitom). */
export async function matchTv(idx?: Map<string, Cand[]>) {
  idx ??= await nameIndex();
  let budget = Number(process.env.TV_TMDB_LOOKUPS ?? 200);
  const todo = await sql<{ norm: string; year: number; series: boolean; title: string; region: string; category: string | null }[]>`
    SELECT norm, coalesce(year, 0) AS year, bool_or(season IS NOT NULL OR episode IS NOT NULL) AS series,
      min(title) AS title, min(region) AS region, min(category) AS category
    FROM tv_airings WHERE title_id IS NULL AND starts_at > now() - interval '1 day'
    GROUP BY 1, 2 ORDER BY count(*) DESC`;
  let matched = 0, searched = 0;
  for (const r of todo) {
    const year = r.year || null;
    let id = pick(idx.get(r.norm), year, r.series)?.id ?? null;
    if (!id) {
      const [m] = await sql<{ title_id: number | null; fresh: boolean }[]>`
        SELECT title_id, checked_at > now() - interval '30 days' AS fresh FROM tv_matches WHERE norm = ${r.norm} AND year = ${r.year}`;
      if (m?.title_id) id = m.title_id;
      else if (!m?.fresh && budget > 0 && looksLikeTitle({ category: r.category, year, season: r.series ? 1 : null, episode: null })) {
        budget--; searched++;
        id = await searchTmdb(r.title, r.norm, year, r.series, r.region).catch((e) => { log(`TV: TMDB „${r.title}“:`, e.message); return null; });
        await sql`INSERT INTO tv_matches (norm, year, title_id) VALUES (${r.norm}, ${r.year}, ${id})
          ON CONFLICT (norm, year) DO UPDATE SET title_id = EXCLUDED.title_id, checked_at = now()`;
      }
    }
    if (!id) continue;
    await sql`UPDATE tv_airings SET title_id = ${id} WHERE title_id IS NULL AND norm = ${r.norm} AND coalesce(year, 0) = ${r.year}`;
    matched++;
  }
  return { names: todo.length, matched, searched };
}

export const tvConfigured = () => REGIONS.some((r) => list(process.env[`TV_XMLTV_${r}`]).length > 0);

export async function importTv() {
  if (!tvConfigured()) return { skipped: "TV_XMLTV_* nie je nastavené" };
  const idx = await nameIndex();
  const out: Record<string, unknown> = {};
  for (const region of REGIONS) {
    if (!list(process.env[`TV_XMLTV_${region}`]).length) continue;
    out[region] = await importRegion(region, idx).catch((e) => { log(`TV ${region}:`, e.message); return { error: e.message }; });
  }
  await sql`DELETE FROM tv_airings WHERE coalesce(ends_at, starts_at) < now() - interval '1 day'`;
  const m = await matchTv(idx);
  const res = { ...out, ...m };
  await sql`INSERT INTO kv (key, value) VALUES ('last_tv_import', ${sql.json({ at: new Date().toISOString(), ...res } as any)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  return res;
}
