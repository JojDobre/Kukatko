import { sql } from "@/lib/db";
import { bad, handler } from "@/lib/api";
import { todayISO } from "@/lib/format";

/** Označí epizódu (alebo celú sezónu, ak chýba episode) ako pozretú. */
export const POST = handler(async (dev, b) => {
  const titleId = Number(b?.titleId), season = Number(b?.season);
  const episode = b?.episode == null ? null : Number(b.episode);
  if (!Number.isInteger(titleId) || !Number.isInteger(season) || (episode !== null && !Number.isInteger(episode))) throw bad("Neplatná epizóda");
  // Film: pozretie ukladáme ako season = 0, episode = 0.
  if (season === 0) {
    if (b?.on) await sql`INSERT INTO watched (device_id, title_id, season, episode) SELECT ${dev}, id, 0, 0 FROM titles WHERE id = ${titleId} AND kind = 'movie' ON CONFLICT DO NOTHING`;
    else await sql`DELETE FROM watched WHERE device_id = ${dev} AND title_id = ${titleId} AND season = 0`;
    return { ok: true };
  }
  const where = sql`title_id = ${titleId} AND season = ${season} ${episode !== null ? sql`AND episode = ${episode}` : sql``}`;
  if (b?.on) {
    await sql`INSERT INTO watched (device_id, title_id, season, episode)
      SELECT ${dev}, title_id, season, episode FROM episodes WHERE ${where} AND air_date <= ${todayISO()}
      ON CONFLICT DO NOTHING`;
  } else {
    await sql`DELETE FROM watched WHERE device_id = ${dev} AND ${where}`;
  }
  return { ok: true };
});
