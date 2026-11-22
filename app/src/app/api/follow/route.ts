import { after } from "next/server";
import { sql } from "@/lib/db";
import { bad, handler } from "@/lib/api";
import { syncAllSeasons } from "@/lib/sync";
import { tmdbConfigured } from "@/lib/tmdb";

export const POST = handler(async (dev, b) => {
  const titleId = Number(b?.titleId);
  if (!Number.isInteger(titleId) || titleId <= 0) throw bad("Neplatný titul");
  const [t] = await sql<{ kind: string; seasons_synced_at: Date | null }[]>`SELECT kind, seasons_synced_at FROM titles WHERE id = ${titleId}`;
  if (!t) throw bad("Titul neexistuje");
  if (b?.on) {
    await sql`INSERT INTO follows (device_id, title_id) VALUES (${dev}, ${titleId}) ON CONFLICT DO NOTHING`;
    // Epizódy na odškrtávanie stiahneme na pozadí, aby odpoveď prišla hneď.
    if (t.kind === "tv" && !t.seasons_synced_at && tmdbConfigured()) after(() => syncAllSeasons(titleId).catch(() => {}));
  } else {
    await sql`DELETE FROM follows WHERE device_id = ${dev} AND title_id = ${titleId}`;
  }
  return { ok: true, on: !!b?.on };
});
