/** OMDb: hodnotenia IMDb a Rotten Tomatoes. Bezplatný kľúč má limit 1000 dopytov denne. */
export type OmdbRatings = { imdb_rating: number | null; imdb_votes: number | null; rt_rating: number | null };

export function parseOmdb(j: any): OmdbRatings | null {
  if (!j || j.Response === "False") return null;
  const num = (s: any) => (s && s !== "N/A" ? Number(String(s).replace(/,/g, "")) : null);
  const rt = (j.Ratings ?? []).find((r: any) => r.Source === "Rotten Tomatoes")?.Value;
  return {
    imdb_rating: num(j.imdbRating),
    imdb_votes: num(j.imdbVotes),
    rt_rating: rt ? Number(String(rt).replace("%", "")) : null,
  };
}

export async function omdbByImdbId(imdbId: string): Promise<OmdbRatings | null | "limit"> {
  const key = process.env.OMDB_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbId)}`);
  if (res.status === 401) {
    const j = await res.json().catch(() => ({}));
    if (/limit/i.test(j?.Error ?? "")) return "limit";
    throw new Error(`OMDb: ${j?.Error ?? "neplatný kľúč"}`);
  }
  if (!res.ok) throw new Error(`OMDb ${res.status}`);
  return parseOmdb(await res.json());
}
