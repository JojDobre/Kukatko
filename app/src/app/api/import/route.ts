import { after } from "next/server";
import { sql } from "@/lib/db";
import { handler } from "@/lib/api";
import { parseImport, type ImportItem } from "@/lib/importers";
import { syncTitle } from "@/lib/sync";
import { tmdb, tmdbConfigured, type Kind } from "@/lib/tmdb";

const MAX_ITEMS = 5000;
const MAX_FETCH = 200; // koľko chýbajúcich titulov doplníme z TMDB na jeden import

async function findLocal(it: ImportItem): Promise<number | null> {
  if (it.tmdb && it.kind) {
    const [r] = await sql<{ id: number }[]>`SELECT id FROM titles WHERE kind = ${it.kind} AND tmdb_id = ${it.tmdb}`;
    if (r) return r.id;
  }
  if (it.imdb) {
    const [r] = await sql<{ id: number }[]>`SELECT id FROM titles WHERE imdb_id = ${it.imdb} ${it.kind ? sql`AND kind = ${it.kind}` : sql``} LIMIT 1`;
    if (r) return r.id;
  }
  if (it.title && it.kind) {
    const [r] = await sql<{ id: number }[]>`SELECT id FROM titles WHERE kind = ${it.kind}
      AND (lower(original_name) = lower(${it.title}) OR lower(i18n->'en'->>'name') = lower(${it.title}))
      ${it.year ? sql`AND year BETWEEN ${it.year - 1} AND ${it.year + 1}` : sql``}
      ORDER BY popularity DESC LIMIT 1`;
    if (r) return r.id;
  }
  return null;
}

/** Nájde titul v TMDB a stiahne ho do katalógu. */
async function fetchRemote(it: ImportItem): Promise<number | null> {
  let kind: Kind | undefined = it.kind, id: number | undefined = it.tmdb;
  if (!id && it.imdb) {
    const f = await tmdb<{ movie_results: { id: number }[]; tv_results: { id: number }[] }>(`/find/${it.imdb}`, { external_source: "imdb_id" });
    if (f.tv_results[0] && kind !== "movie") { kind = "tv"; id = f.tv_results[0].id; }
    else if (f.movie_results[0]) { kind = "movie"; id = f.movie_results[0].id; }
  }
  if (!id && it.title && kind) {
    const s = await tmdb<{ results: { id: number }[] }>(`/search/${kind}`, { query: it.title, ...(it.year ? { [kind === "movie" ? "year" : "first_air_date_year"]: it.year } : {}) });
    id = s.results[0]?.id;
  }
  return id && kind ? syncTitle(kind, id) : null;
}

async function apply(dev: string, it: ImportItem, titleId: number) {
  if (it.action === "rate" && it.value) {
    await sql`INSERT INTO ratings (device_id, title_id, value) VALUES (${dev}, ${titleId}, ${it.value})
      ON CONFLICT (device_id, title_id) DO UPDATE SET value = EXCLUDED.value`;
  } else if (it.action === "want") {
    await sql`INSERT INTO want (device_id, title_id) VALUES (${dev}, ${titleId}) ON CONFLICT DO NOTHING`;
  } else if (it.action === "seen") {
    await sql`INSERT INTO watched (device_id, title_id, season, episode)
      SELECT ${dev}, id, 0, 0 FROM titles WHERE id = ${titleId} AND kind = 'movie' ON CONFLICT DO NOTHING`;
  }
}

async function recompute(ids: number[]) {
  if (ids.length) await sql`UPDATE titles t SET (user_avg, user_count) = (SELECT avg(value)::real, count(*)::int FROM ratings r WHERE r.title_id = t.id)
    WHERE t.id = ANY(${ids}::int[])`;
}

/** Import exportu z IMDb, Letterboxd alebo Trakt. Telo: { name, text }. */
export const POST = handler(async (dev, b) => {
  const text = String(b?.text ?? "");
  if (!text || text.length > 8_000_000) return new Response(JSON.stringify({ error: "file" }), { status: 400 });
  let parsed;
  try { parsed = parseImport(String(b?.name ?? ""), text); } catch { return new Response(JSON.stringify({ error: "format" }), { status: 400 }); }
  const items = parsed.items.slice(0, MAX_ITEMS);
  const counts = { r: 0, w: 0, s: 0, u: 0 };
  const missing: ImportItem[] = [];
  const rated: number[] = [];
  for (const it of items) {
    const id = await findLocal(it);
    if (!id) { missing.push(it); continue; }
    await apply(dev, it, id);
    if (it.action === "rate") { counts.r++; rated.push(id); } else if (it.action === "want") counts.w++; else counts.s++;
  }
  await recompute(rated);
  counts.u = missing.length;
  // Chýbajúce tituly doplníme z TMDB na pozadí, aby užívateľ nečakal.
  const later = tmdbConfigured() ? missing.slice(0, MAX_FETCH) : [];
  if (later.length) after(async () => {
    const ids: number[] = [];
    for (const it of later) {
      try { const id = await fetchRemote(it); if (id) { await apply(dev, it, id); if (it.action === "rate") ids.push(id); } } catch { /* titul sa nenašiel */ }
    }
    await recompute(ids);
  });
  return { ok: true, source: parsed.source, ...counts, later: later.length };
}, { limit: [6, 600] });
