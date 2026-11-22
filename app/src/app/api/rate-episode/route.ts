import { sql } from "@/lib/db";
import { bad, handler } from "@/lib/api";

/** Hodnotenie jednej epizódy (1–10, null = zrušiť). */
export const POST = handler(async (dev, b) => {
  const titleId = Number(b?.titleId), season = Number(b?.season), episode = Number(b?.episode);
  const value = b?.value == null ? null : Number(b.value);
  if (![titleId, season, episode].every((n) => Number.isInteger(n) && n > 0)) throw bad("Neplatná epizóda");
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 10)) throw bad("Hodnotenie musí byť 1 až 10");
  const [ok] = await sql`SELECT 1 FROM episodes WHERE title_id = ${titleId} AND season = ${season} AND episode = ${episode}`;
  if (!ok) throw bad("Epizóda neexistuje");
  await sql.begin(async (tx) => {
    if (value === null) await tx`DELETE FROM episode_ratings WHERE device_id = ${dev} AND title_id = ${titleId} AND season = ${season} AND episode = ${episode}`;
    else await tx`INSERT INTO episode_ratings (device_id, title_id, season, episode, value)
      SELECT ${dev}, title_id, season, episode, ${value} FROM episodes WHERE title_id = ${titleId} AND season = ${season} AND episode = ${episode}
      ON CONFLICT (device_id, title_id, season, episode) DO UPDATE SET value = EXCLUDED.value, created_at = now()`;
    await tx`UPDATE episodes SET (user_avg, user_count) = (SELECT avg(value)::real, count(*)::int FROM episode_ratings
      WHERE title_id = ${titleId} AND season = ${season} AND episode = ${episode})
      WHERE title_id = ${titleId} AND season = ${season} AND episode = ${episode}`;
  });
  return { ok: true };
});
