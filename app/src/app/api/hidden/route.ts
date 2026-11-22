import { sql } from "@/lib/db";
import { bad, handler } from "@/lib/api";

/** „Nezaujíma ma“: titul sa prestane ukazovať v odporúčaniach. */
export const POST = handler(async (dev, b) => {
  const titleId = Number(b?.titleId);
  if (!Number.isInteger(titleId) || titleId <= 0) throw bad("Neplatný titul");
  if (b?.on) await sql`INSERT INTO hidden (device_id, title_id) SELECT ${dev}, id FROM titles WHERE id = ${titleId} ON CONFLICT DO NOTHING`;
  else await sql`DELETE FROM hidden WHERE device_id = ${dev} AND title_id = ${titleId}`;
  return { ok: true };
});
