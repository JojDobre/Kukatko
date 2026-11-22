import { sql } from "@/lib/db";
import { handler } from "@/lib/api";

export const POST = handler(async (dev, b) => {
  const prefs = { episodes: b?.episodes !== false, seasons: b?.seasons !== false, availability: b?.availability !== false, reminder: b?.reminder !== false };
  await sql`UPDATE devices SET prefs = ${sql.json(prefs)} WHERE id = ${dev}`;
  return { ok: true, prefs };
});
