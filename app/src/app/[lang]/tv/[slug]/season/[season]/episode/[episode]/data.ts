import { notFound } from "next/navigation";
import { getEpisode } from "@/lib/extra";
import { getTitle } from "@/lib/queries";
import { syncSeasons } from "@/lib/sync";
import { tmdbConfigured } from "@/lib/tmdb";

export type EpParams = Promise<{ lang: string; slug: string; season: string; episode: string }>;

/** Načíta seriál a epizódu. Ak epizódu ešte nemáme, skúsi stiahnuť jej sezónu z TMDB. */
export async function loadEpisode(params: EpParams) {
  const p = await params;
  const season = Number(p.season), episode = Number(p.episode);
  if (!Number.isInteger(season) || !Number.isInteger(episode) || season < 1 || episode < 1 || season > 200 || episode > 2000) notFound();
  const t = await getTitle("tv", Number(p.slug.split("-")[0]) || 0);
  if (!t) notFound();
  let e = await getEpisode(t.id, season, episode);
  if (!e && tmdbConfigured() && t.seasons && season <= t.seasons) {
    await syncSeasons(t.id, t.tmdb_id, [season]).catch(() => {});
    e = await getEpisode(t.id, season, episode);
  }
  if (!e) notFound();
  return { t, e, season, episode, slug: p.slug };
}
