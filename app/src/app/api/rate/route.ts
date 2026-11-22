import { sql } from "@/lib/db";
import { bad, handler } from "@/lib/api";

export const POST = handler(async (dev, b) => {
  const titleId = Number(b?.titleId);
  const value = b?.value == null ? null : Number(b.value);
  if (!Number.isInteger(titleId) || titleId <= 0) throw bad("Neplatný titul");
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 10)) throw bad("Hodnotenie musí byť 1 až 10");
  await sql.begin(async (tx) => {
    if (value === null) await tx`DELETE FROM ratings WHERE device_id = ${dev} AND title_id = ${titleId}`;
    else await tx`INSERT INTO ratings (device_id, title_id, value) SELECT ${dev}, id, ${value} FROM titles WHERE id = ${titleId}
      ON CONFLICT (device_id, title_id) DO UPDATE SET value = EXCLUDED.value, created_at = now()`;
    await tx`UPDATE titles SET (user_avg, user_count) = (SELECT avg(value)::real, count(*)::int FROM ratings WHERE title_id = ${titleId})
      WHERE id = ${titleId}`;
  });
  return { ok: true };
});
