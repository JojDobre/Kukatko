import { slugify } from "./format";
import { ALL_LOCALES, COUNTRIES, GLOBAL, LANGS, type Lang } from "./locales";

const BASE = "https://api.themoviedb.org/3";
export type Kind = "tv" | "movie";

function auth(): { headers: Record<string, string>; query: string } {
  const token = process.env.TMDB_TOKEN;
  const key = process.env.TMDB_API_KEY;
  if (token) return { headers: { Authorization: `Bearer ${token}` }, query: "" };
  if (key) return { headers: {}, query: `api_key=${encodeURIComponent(key)}` };
  throw new Error("Chýba TMDB_TOKEN alebo TMDB_API_KEY (pozri .env.example)");
}

export const tmdbConfigured = () => !!(process.env.TMDB_TOKEN || process.env.TMDB_API_KEY);

export async function tmdb<T = any>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const a = auth();
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const url = `${BASE}${path}?${[qs, a.query].filter(Boolean).join("&")}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json", ...a.headers }, cache: "no-store" });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = Number(res.headers.get("retry-after") ?? 0) * 1000 || 500 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const body = await res.text().catch(() => "");
    const err = new Error(`TMDB ${res.status} ${path}: ${body.slice(0, 200)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

/** Tituly dostupné na streamovacích službách v regióne, zoradené podľa popularity. */
export function discoverPage(kind: Kind, region: string, page: number) {
  return tmdb<{ page: number; total_pages: number; results: { id: number }[] }>(`/discover/${kind}`, {
    watch_region: region,
    with_watch_monetization_types: "flatrate|free|ads",
    sort_by: "popularity.desc",
    include_adult: "false",
    page,
  });
}

export function titleDetails(kind: Kind, id: number) {
  const vidLangs = [...new Set([...LANGS, "en"])].join(",");
  return tmdb(`/${kind}/${id}`, {
    language: "en-US",
    append_to_response: "credits,watch/providers,external_ids,videos,translations",
    include_video_language: `${vidLangs},null`,
  });
}

export type TmdbEpisode = {
  episode_number: number; name: string; overview?: string; air_date: string | null; runtime: number | null;
  still_path?: string | null; vote_average?: number; vote_count?: number;
  crew?: { job: string; name: string }[]; guest_stars?: { id: number; name: string; character?: string; profile_path?: string | null; order?: number }[];
};

export function seasonDetails(id: number, season: number, lang: Lang) {
  return tmdb<{ episodes: TmdbEpisode[] }>(
    `/tv/${id}/season/${season}`,
    { language: ALL_LOCALES[lang].tmdb },
  );
}

export function genreList(kind: Kind, lang: Lang) {
  return tmdb<{ genres: { id: number; name: string }[] }>(`/genre/${kind}/list`, { language: ALL_LOCALES[lang].tmdb });
}

export function personDetails(id: number) {
  return tmdb(`/person/${id}`, { language: "en-US", append_to_response: "combined_credits,translations" });
}

export type Ep = { season: number; episode: number; name: string; air_date: string | null };
export type Provider = { id: number; name: string; logo_path: string | null; type: string };
export type Texts = { name: string; overview: string | null; tagline: string | null; slug: string };

export type TitleRow = {
  kind: Kind; tmdb_id: number; original_name: string; original_language: string | null;
  i18n: Partial<Record<Lang, Texts>>;
  poster_path: string | null; backdrop_path: string | null; release_date: string | null; year: number | null;
  status: string | null; genre_ids: number[]; seasons: number | null; episodes: number | null; runtime: number | null;
  creators: string[]; cast: { id: number; name: string; character: string | null; profile_path: string | null }[];
  providers: Record<string, Provider[]>; provider_keys: string[]; regions: string[];
  watch_links: Record<string, string>; trailers: Partial<Record<Lang, string>>;
  next_ep: Ep | null; next_air_date: string | null; last_ep: Ep | null;
  popularity: number; tmdb_rating: number | null; tmdb_votes: number; imdb_id: string | null;
};

const ep = (e: any): Ep | null =>
  e ? { season: e.season_number, episode: e.episode_number, name: e.name ?? "", air_date: e.air_date || null } : null;

/** Preklad z TMDB pre jazyk (pri angličtine uprednostní britskú/americkú verziu). */
function translation(d: any, lang: string): any | null {
  const all: any[] = d.translations?.translations ?? [];
  const hits = all.filter((t) => t.iso_639_1 === lang);
  if (!hits.length) return null;
  const region = (ALL_LOCALES as any)[lang]?.region;
  return (hits.find((t) => t.iso_3166_1 === region) ?? hits.find((t) => t.iso_3166_1 === "US") ?? hits[0]).data ?? null;
}

/** Texty pre jeden jazyk s rozumnými náhradami. */
export function textsFor(d: any, kind: Kind, lang: Lang): Texts {
  const nameKey = kind === "movie" ? "title" : "name";
  const original = (kind === "movie" ? d.original_title : d.original_name) ?? d[nameKey] ?? "";
  const own = translation(d, lang);
  const en = translation(d, "en");
  const chain = [own, ...ALL_LOCALES[lang].fallback.map((l) => translation(d, l)), en];
  // Názov: vlastný preklad, inak originál (ak je v tomto jazyku), inak anglický, inak originál.
  const name =
    own?.[nameKey] ||
    (d.original_language === lang ? original : "") ||
    en?.[nameKey] || d[nameKey] || original || `#${d.id}`;
  const pick = (f: "overview" | "tagline") => chain.find((t) => t?.[f])?.[f] || d[f] || null;
  return { name, overview: pick("overview"), tagline: pick("tagline"), slug: slugify(name) };
}

/** Prevedie odpoveď TMDB na riadok tabuľky `titles`. Čistá funkcia, dá sa testovať. */
export function mapTitle(kind: Kind, d: any, langs: Lang[] = LANGS, regions: string[] = COUNTRIES): TitleRow {
  const i18n: TitleRow["i18n"] = {};
  for (const l of langs) i18n[l] = textsFor(d, kind, l);

  const providers: TitleRow["providers"] = {};
  const watch_links: Record<string, string> = {};
  for (const region of regions) {
    const wp = d["watch/providers"]?.results?.[region];
    if (!wp) continue;
    const seen = new Set<number>();
    const list: Provider[] = [];
    for (const type of ["flatrate", "free", "ads"] as const) {
      for (const p of [...(wp[type] ?? [])].sort((a: any, b: any) => a.display_priority - b.display_priority)) {
        if (seen.has(p.provider_id)) continue;
        seen.add(p.provider_id);
        list.push({ id: p.provider_id, name: p.provider_name, logo_path: p.logo_path ?? null, type });
      }
    }
    if (list.length) providers[region] = list;
    if (wp.link) watch_links[region] = wp.link;
  }
  // „Celý svet“: platformy zo všetkých krajín, najčastejšie prvé (predplatné pred bezplatnými).
  const all = Object.values(providers).flat();
  if (all.length) {
    const count = new Map<number, number>();
    for (const p of all) count.set(p.id, (count.get(p.id) ?? 0) + 1);
    const rank: Record<string, number> = { flatrate: 0, free: 1, ads: 2 };
    const best = new Map<number, Provider>();
    for (const p of all) { const b = best.get(p.id); if (!b || rank[p.type] < rank[b.type]) best.set(p.id, p); }
    providers[GLOBAL] = [...best.values()].sort((a, b) => rank[a.type] - rank[b.type] || count.get(b.id)! - count.get(a.id)!).slice(0, 25);
  }

  const vids: any[] = (d.videos?.results ?? []).filter((v: any) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
  const bestVid = (l: string) => {
    const own = vids.filter((v) => v.iso_639_1 === l);
    return (own.find((v) => v.type === "Trailer" && v.official) ?? own.find((v) => v.type === "Trailer") ?? own[0])?.key ?? null;
  };
  const enTrailer = bestVid("en") ?? vids[0]?.key ?? null;
  const trailers: TitleRow["trailers"] = {};
  for (const l of langs) { const k = bestVid(l) ?? enTrailer; if (k) trailers[l] = k; }

  const release = (kind === "movie" ? d.release_date : d.first_air_date) || null;
  const creators = kind === "movie"
    ? (d.credits?.crew ?? []).filter((c: any) => c.job === "Director").map((c: any) => c.name)
    : (d.created_by ?? []).map((c: any) => c.name);

  return {
    kind,
    tmdb_id: d.id,
    original_name: (kind === "movie" ? d.original_title : d.original_name) ?? d.title ?? d.name ?? `#${d.id}`,
    original_language: d.original_language ?? null,
    i18n,
    poster_path: d.poster_path ?? null,
    backdrop_path: d.backdrop_path ?? null,
    release_date: release,
    year: release ? Number(release.slice(0, 4)) : null,
    status: d.status ?? null,
    genre_ids: (d.genres ?? []).map((g: any) => g.id),
    seasons: kind === "tv" ? d.number_of_seasons ?? null : null,
    episodes: kind === "tv" ? d.number_of_episodes ?? null : null,
    runtime: kind === "movie" ? d.runtime || null : d.episode_run_time?.[0] || d.last_episode_to_air?.runtime || null,
    creators: [...new Set<string>(creators)].slice(0, 6),
    cast: [...(d.credits?.cast ?? [])]
      .sort((a: any, b: any) => a.order - b.order)
      .slice(0, 15)
      .map((c: any) => ({ id: c.id, name: c.name, character: c.character || null, profile_path: c.profile_path ?? null })),
    providers,
    provider_keys: Object.entries(providers).flatMap(([r, list]) => list.map((p) => `${r}:${p.id}`)),
    regions: Object.keys(providers),
    watch_links,
    trailers,
    next_ep: kind === "tv" ? ep(d.next_episode_to_air) : null,
    next_air_date: kind === "tv" ? d.next_episode_to_air?.air_date || null : null,
    last_ep: kind === "tv" ? ep(d.last_episode_to_air) : null,
    popularity: Number(d.popularity ?? 0),
    tmdb_rating: d.vote_count ? Number(d.vote_average) : null,
    tmdb_votes: d.vote_count ?? 0,
    imdb_id: (kind === "movie" ? d.imdb_id : null) || d.external_ids?.imdb_id || null,
  };
}

export type PersonRow = {
  id: number; name: string; slug: string; profile_path: string | null; birthday: string | null; deathday: string | null;
  birthplace: string | null; known_for: string | null; bio: Partial<Record<Lang, string>>; popularity: number;
  credits: { kind: Kind; tmdb_id: number; name: string; character: string | null; year: number | null; poster_path: string | null; popularity: number }[];
};

export function mapPerson(d: any, langs: Lang[] = LANGS): PersonRow {
  const bio: PersonRow["bio"] = {};
  for (const l of langs) {
    const t = [l, ...ALL_LOCALES[l].fallback, "en"].map((x) => translation(d, x)?.biography).find(Boolean) || d.biography;
    if (t) bio[l] = t;
  }
  const seen = new Set<string>();
  const credits: PersonRow["credits"] = [];
  for (const c of [...(d.combined_credits?.cast ?? []), ...(d.combined_credits?.crew ?? []).filter((c: any) => c.job === "Director" || c.job === "Creator")]) {
    if (c.media_type !== "tv" && c.media_type !== "movie") continue;
    const key = `${c.media_type}:${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const date = c.media_type === "movie" ? c.release_date : c.first_air_date;
    credits.push({
      kind: c.media_type, tmdb_id: c.id, name: c.media_type === "movie" ? c.title : c.name,
      character: c.character || c.job || null, year: date ? Number(date.slice(0, 4)) : null,
      poster_path: c.poster_path ?? null, popularity: Number(c.popularity ?? 0),
    });
  }
  credits.sort((a, b) => b.popularity - a.popularity);
  return {
    id: d.id, name: d.name, slug: slugify(d.name ?? String(d.id)), profile_path: d.profile_path ?? null,
    birthday: d.birthday || null, deathday: d.deathday || null, birthplace: d.place_of_birth || null,
    known_for: d.known_for_department || null, bio, popularity: Number(d.popularity ?? 0), credits: credits.slice(0, 80),
  };
}

export type EpisodeRow = {
  episode: number; air_date: string | null; runtime: number | null; names: Record<string, string>; overviews: Record<string, string>;
  still_path: string | null; tmdb_rating: number | null; tmdb_votes: number; directors: string[]; writers: string[];
  guests: { id: number; name: string; character: string | null; profile_path: string | null }[];
};

// TMDB vracia „Episode 3“ / „Epizoda 3“, keď preklad chýba. Taký názov neukladáme.
const GENERIC_NAME = /^(episode|epizóda|epizoda|odcinek|epizód|folge|rész|díl)\s*\d+$/i;

/** Zlúči odpovede jednej sezóny v rôznych jazykoch do riadkov tabuľky `episodes`. Čistá funkcia. */
export function mergeSeason(perLang: { lang: string; episodes: TmdbEpisode[] }[]): EpisodeRow[] {
  const out = new Map<number, EpisodeRow>();
  for (const { lang, episodes } of perLang) {
    for (const e of episodes) {
      let row = out.get(e.episode_number);
      if (!row) {
        row = {
          episode: e.episode_number, air_date: e.air_date || null, runtime: e.runtime ?? null, names: {}, overviews: {},
          still_path: e.still_path ?? null, tmdb_rating: e.vote_count ? Number(e.vote_average) : null, tmdb_votes: e.vote_count ?? 0,
          directors: [...new Set((e.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name))],
          writers: [...new Set((e.crew ?? []).filter((c) => c.job === "Writer" || c.job === "Screenplay" || c.job === "Teleplay").map((c) => c.name))],
          guests: [...(e.guest_stars ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).slice(0, 12)
            .map((g) => ({ id: g.id, name: g.name, character: g.character || null, profile_path: g.profile_path ?? null })),
        };
        out.set(e.episode_number, row);
      }
      if (e.name && !GENERIC_NAME.test(e.name.trim())) row.names[lang] = e.name;
      // TMDB pri chýbajúcom preklade popisu vracia prázdny text.
      if (e.overview?.trim()) row.overviews[lang] = e.overview.trim();
      row.still_path ??= e.still_path ?? null;
    }
  }
  return [...out.values()].sort((a, b) => a.episode - b.episode);
}
