import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Pre monitoring (UptimeRobot a pod.): 200 = všetko v poriadku,
 * 503 = nefunguje databáza alebo robot nestiahol dáta viac ako 36 hodín.
 */
export async function GET() {
  try {
    const [r] = await sql<{ titles: number; last: { at: string } | null }[]>`
      SELECT (SELECT count(*)::int FROM titles) AS titles, (SELECT value FROM kv WHERE key = 'last_full_sync') AS last`;
    const age = r.last?.at ? (Date.now() - Date.parse(r.last.at)) / 36e5 : null;
    const ok = r.titles > 0 && age !== null && age < 36;
    return NextResponse.json({ ok, titles: r.titles, lastSyncHoursAgo: age && Math.round(age * 10) / 10 }, { status: ok ? 200 : 503 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "database" }, { status: 503 });
  }
}
