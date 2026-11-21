import { sql } from "@/lib/db";
import { bad, handler } from "@/lib/api";

export const POST = handler(async (dev, b) => {
  const showId = Number(b?.showId);
  if (!Number.isInteger(showId) || showId <= 0) throw bad("Neplatný seriál");
  if (b?.on) {
    const r = await sql`INSERT INTO follows (device_id, show_id) SELECT ${dev}, id FROM shows WHERE id = ${showId}
      ON CONFLICT DO NOTHING RETURNING 1`;
    const [exists] = await sql`SELECT 1 FROM shows WHERE id = ${showId}`;
    if (!r.length && !exists) throw bad("Seriál neexistuje");
  } else {
    await sql`DELETE FROM follows WHERE device_id = ${dev} AND show_id = ${showId}`;
  }
  return { ok: true, on: !!b?.on };
});
