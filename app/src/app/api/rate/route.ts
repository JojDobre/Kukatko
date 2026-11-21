import { sql } from "@/lib/db";
import { bad, handler } from "@/lib/api";

export const POST = handler(async (dev, b) => {
  const showId = Number(b?.showId);
  const value = b?.value == null ? null : Number(b.value);
  if (!Number.isInteger(showId) || showId <= 0) throw bad("Neplatný seriál");
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 10)) throw bad("Hodnotenie musí byť 1 až 10");
  await sql.begin(async (tx) => {
    if (value === null) await tx`DELETE FROM ratings WHERE device_id = ${dev} AND show_id = ${showId}`;
    else await tx`INSERT INTO ratings (device_id, show_id, value) SELECT ${dev}, id, ${value} FROM shows WHERE id = ${showId}
      ON CONFLICT (device_id, show_id) DO UPDATE SET value = EXCLUDED.value, created_at = now()`;
    await tx`UPDATE shows SET (user_avg, user_count) = (SELECT avg(value)::real, count(*)::int FROM ratings WHERE show_id = ${showId})
      WHERE id = ${showId}`;
  });
  return { ok: true };
});
