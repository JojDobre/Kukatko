import { slugify } from "./format";

const BASE = "https://api.themoviedb.org/3";
export const REGION = process.env.WATCH_REGION ?? "SK";
export const LANG = process.env.TMDB_LANGUAGE ?? "sk-SK";
const FALLBACK_LANGS = (process.env.TMDB_FALLBACK_LANGS ?? "cs,en").split(",");

function auth(): { headers: Record<string, string>; query: string } {
  const token = process.env.TMDB_TOKEN;
  const key = process.env.TMDB_API_KEY;
  if (token) return { headers: { Authorization: `Bearer ${token}` }, query: "" };
  if (key) return { headers: {}, query: `api_key=${encodeURIComponent(key)}` };
  throw new Error("Chýba TMDB_TOKEN alebo TMDB_API_KEY (pozri .env.example)");
}

export async function tmdb<T = any>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const a = auth();
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const url = `${BASE}${path}?${[qs, a.query].filter(Boolean).join("&")}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json", ...a.headers } });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = Number(res.headers.get("retry-after") ?? 0) * 1000 || 500 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(`TMDB ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
}

/** Seriály dostupné na streamovacích službách v regióne, zoradené podľa popularity. */
export async function discoverPage(page: number) {
  return tmdb<{ page: number; total_pages: number; results: { id: number }[] }>("/discover/tv", {
    watch_region: REGION,
    with_watch_monetization_types: "flatrate|free|ads",
    sort_by: "popularity.desc",
    include_adult: "false",
    language: LANG,
    page,
  });
}

export async function showDetails(id: number) {
  return tmdb(`/tv/${id}`, {
    language: LANG,
    append_to_response: "credits,watch/providers,external_ids,videos,translations",
    include_video_language: `${LANG.slice(0, 2)},cs,en,null`,
  });
}

export async function seasonDetails(id: number, season: number) {
  return tmdb<{ episodes: { episode_number: number; name: string; air_date: string | null }[] }>(
    `/tv/${id}/season/${season}`,
    { language: LANG },
  );
}

export type Ep = { season: number; episode: number; name: string; air_date: string | null };

export type ShowRow = {
  id: number; slug: string; name: string; original_name: string | null; overview: string | null; tagline: string | null;
  poster_path: string | null; backdrop_path: string | null; first_air_date: string | null; year: number | null;
  status: string | null; genres: string[]; seasons: number | null; episodes: number | null; creators: string[];
  cast: { name: string; character: string | null; profile_path: string | null }[];
  providers: { id: number; name: string; logo_path: string | null; type: string }[]; provider_ids: number[];
  watch_link: string | null; next_ep: Ep | null; next_air_date: string | null; last_ep: Ep | null;
  trailer_key: string | null; popularity: number; tmdb_rating: number | null; tmdb_votes: number; imdb_id: string | null;
};

const ep = (e: any): Ep | null =>
  e ? { season: e.season_number, episode: e.episode_number, name: e.name ?? "", air_date: e.air_date || null } : null;

/** Prevedie odpoveď TMDB na riadok tabuľky `shows`. Čistá funkcia, dá sa testovať. */
export function mapShow(d: any, region = REGION): ShowRow {
  const lang = LANG.slice(0, 2);
  const tr: any[] = d.translations?.translations ?? [];
  const pick = (field: "overview" | "tagline" | "name") => {
    if (d[field]) return d[field] as string;
    for (const l of FALLBACK_LANGS) {
      const t = tr.find((x) => x.iso_639_1 === l)?.data?.[field];
      if (t) return t as string;
    }
    return null;
  };

  const wp = d["watch/providers"]?.results?.[region] ?? {};
  const seen = new Set<number>();
  const providers: ShowRow["providers"] = [];
  for (const type of ["flatrate", "free", "ads"] as const) {
    for (const p of (wp[type] ?? []).sort((a: any, b: any) => a.display_priority - b.display_priority)) {
      if (seen.has(p.provider_id)) continue;
      seen.add(p.provider_id);
      providers.push({ id: p.provider_id, name: p.provider_name, logo_path: p.logo_path ?? null, type });
    }
  }

  const vids: any[] = (d.videos?.results ?? []).filter((v: any) => v.site === "YouTube");
  const trailer =
    vids.find((v) => v.type === "Trailer" && v.iso_639_1 === lang) ??
    vids.find((v) => v.type === "Trailer" && v.official) ??
    vids.find((v) => v.type === "Trailer") ??
    vids.find((v) => v.type === "Teaser");

  const name = pick("name") ?? d.original_name ?? `Seriál ${d.id}`;
  const first = d.first_air_date || null;

  return {
    id: d.id,
    slug: slugify(d.original_name && /^[\x00-\x7F]+$/.test(d.original_name) ? d.original_name : name),
    name,
    original_name: d.original_name ?? null,
    overview: pick("overview"),
    tagline: pick("tagline"),
    poster_path: d.poster_path ?? null,
    backdrop_path: d.backdrop_path ?? null,
    first_air_date: first,
    year: first ? Number(first.slice(0, 4)) : null,
    status: d.status ?? null,
    genres: (d.genres ?? []).map((g: any) => g.name),
    seasons: d.number_of_seasons ?? null,
    episodes: d.number_of_episodes ?? null,
    creators: (d.created_by ?? []).map((c: any) => c.name),
    cast: (d.credits?.cast ?? [])
      .sort((a: any, b: any) => a.order - b.order)
      .slice(0, 12)
      .map((c: any) => ({ name: c.name, character: c.character || null, profile_path: c.profile_path ?? null })),
    providers,
    provider_ids: providers.map((p) => p.id),
    watch_link: wp.link ?? null,
    next_ep: ep(d.next_episode_to_air),
    next_air_date: d.next_episode_to_air?.air_date || null,
    last_ep: ep(d.last_episode_to_air),
    trailer_key: trailer?.key ?? null,
    popularity: Number(d.popularity ?? 0),
    tmdb_rating: d.vote_count ? Number(d.vote_average) : null,
    tmdb_votes: d.vote_count ?? 0,
    imdb_id: d.external_ids?.imdb_id || null,
  };
}
