import { sql } from "@/lib/db";
import { bad, handler } from "@/lib/api";

/** Zoznam „Chcem vidieť“. */
export const POST = handler(async (dev, b) => {
  const titleId = Number(b?.titleId);
  if (!Number.isInteger(titleId) || titleId <= 0) throw bad("Neplatný titul");
  if (b?.on) await sql`INSERT INTO want (device_id, title_id) SELECT ${dev}, id FROM titles WHERE id = ${titleId} ON CONFLICT DO NOTHING`;
  else await sql`DELETE FROM want WHERE device_id = ${dev} AND title_id = ${titleId}`;
  return { ok: true };
});
