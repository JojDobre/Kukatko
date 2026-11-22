import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { randomInt } from "node:crypto";
import { sql } from "@/lib/db";
import { handler } from "@/lib/api";
import { DEVICE_COOKIE, ensureDevice } from "@/lib/device";
import { DEFAULT_LANG, href, isLang } from "@/lib/locales";
import { SITE_URL } from "@/lib/site";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bez 0/O a 1/I, aby sa nepomýlili

/** Vytvorí kód (platí 15 minút) a QR kód s odkazom. */
export const POST = handler(async (dev) => {
  await sql`DELETE FROM transfer_codes WHERE device_id = ${dev} OR expires_at < now()`;
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const r = await sql`INSERT INTO transfer_codes (code, device_id, expires_at) VALUES (${code}, ${dev}, now() + interval '15 minutes')
      ON CONFLICT DO NOTHING RETURNING 1`;
    if (r.length) break;
  }
  const l = (await cookies()).get("lang")?.value;
  const url = `${SITE_URL}${href(isLang(l) ? l : DEFAULT_LANG, `/transfer?code=${code}`)}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 336, errorCorrectionLevel: "M" });
  return { code, url, qr };
});

/** Použije kód: toto zariadenie prevezme identitu pôvodného a pridá k nej svoje údaje. */
export async function PUT(req: Request) {
  try {
    const dev = await ensureDevice();
    const { code } = await req.json().catch(() => ({}));
    const clean = String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const [row] = await sql<{ device_id: string }[]>`DELETE FROM transfer_codes WHERE code = ${clean} AND expires_at > now() RETURNING device_id`;
    if (!row) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const target = row.device_id;
    if (target !== dev) {
      await sql.begin(async (tx) => {
        await tx`INSERT INTO follows (device_id, title_id, created_at) SELECT ${target}, title_id, created_at FROM follows WHERE device_id = ${dev} ON CONFLICT DO NOTHING`;
        await tx`INSERT INTO watched (device_id, title_id, season, episode, created_at) SELECT ${target}, title_id, season, episode, created_at FROM watched WHERE device_id = ${dev} ON CONFLICT DO NOTHING`;
        const touched = await tx<{ title_id: number }[]>`INSERT INTO ratings (device_id, title_id, value, created_at)
          SELECT ${target}, title_id, value, created_at FROM ratings WHERE device_id = ${dev} ON CONFLICT DO NOTHING RETURNING title_id`;
        await tx`UPDATE reviews r SET device_id = ${target} WHERE r.device_id = ${dev}
          AND NOT EXISTS (SELECT 1 FROM reviews x WHERE x.device_id = ${target} AND x.title_id = r.title_id AND x.season = r.season AND x.episode = r.episode)`;
        await tx`INSERT INTO episode_ratings (device_id, title_id, season, episode, value, created_at)
          SELECT ${target}, title_id, season, episode, value, created_at FROM episode_ratings WHERE device_id = ${dev} ON CONFLICT DO NOTHING`;
        await tx`INSERT INTO want (device_id, title_id, created_at) SELECT ${target}, title_id, created_at FROM want WHERE device_id = ${dev} ON CONFLICT DO NOTHING`;
        await tx`INSERT INTO hidden (device_id, title_id, created_at) SELECT ${target}, title_id, created_at FROM hidden WHERE device_id = ${dev} ON CONFLICT DO NOTHING`;
        await tx`UPDATE push_subscriptions SET device_id = ${target} WHERE device_id = ${dev}`;
        await tx`UPDATE devices t SET
            premium_until = GREATEST(t.premium_until, s.premium_until),
            stripe_customer = COALESCE(t.stripe_customer, s.stripe_customer),
            stripe_subscription = COALESCE(t.stripe_subscription, s.stripe_subscription)
          FROM devices s WHERE t.id = ${target} AND s.id = ${dev}`;
        const old = await tx<{ title_id: number }[]>`SELECT title_id FROM ratings WHERE device_id = ${dev}`;
        await tx`DELETE FROM devices WHERE id = ${dev}`;
        const ids = [...new Set([...touched, ...old].map((r) => r.title_id))];
        await tx`UPDATE episodes e SET (user_avg, user_count) = (SELECT avg(value)::real, count(*)::int FROM episode_ratings r
          WHERE r.title_id = e.title_id AND r.season = e.season AND r.episode = e.episode)
          WHERE e.user_count > 0 OR (e.title_id, e.season, e.episode) IN (SELECT title_id, season, episode FROM episode_ratings WHERE device_id = ${target})`;
        if (ids.length) await tx`UPDATE titles t SET (user_avg, user_count) = (SELECT avg(value)::real, count(*)::int FROM ratings r WHERE r.title_id = t.id)
          WHERE t.id = ANY(${ids}::int[])`;
      });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(DEVICE_COOKIE, target, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 * 2, secure: SITE_URL.startsWith("https") });
    return res;
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "Niečo sa pokazilo" }, { status: 500 });
  }
}
