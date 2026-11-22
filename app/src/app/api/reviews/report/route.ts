import { sql } from "@/lib/db";
import { handler } from "@/lib/api";

/** Nahlásenie recenzie. Po 3 nahláseniach od rôznych zariadení sa skryje do kontroly. */
export const POST = handler(async (dev, b) => {
  const id = Number(b?.id);
  if (!Number.isInteger(id)) return { ok: false };
  const ins = await sql`INSERT INTO review_reports (review_id, device_id) SELECT id, ${dev} FROM reviews WHERE id = ${id} AND device_id <> ${dev}
    ON CONFLICT DO NOTHING RETURNING 1`;
  if (ins.length) {
    await sql`UPDATE reviews SET reports = reports + 1,
      status = CASE WHEN reports + 1 >= ${Number(process.env.REVIEW_REPORT_LIMIT ?? 3)} AND status = 'visible' THEN 'pending' ELSE status END
      WHERE id = ${id}`;
  }
  return { ok: true };
});
