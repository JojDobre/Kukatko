import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { bad, handler } from "@/lib/api";

/** Verejný VAPID kľúč pre prehliadač (číta sa za behu, nie pri builde). */
export function GET() {
  return NextResponse.json({ key: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null });
}

export const POST = handler(async (dev, b) => {
  const endpoint = String(b?.endpoint ?? "");
  const p256dh = String(b?.keys?.p256dh ?? "");
  const auth = String(b?.keys?.auth ?? "");
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) throw bad("Neplatné prihlásenie na upozornenia");
  await sql`INSERT INTO push_subscriptions (endpoint, device_id, p256dh, auth) VALUES (${endpoint}, ${dev}, ${p256dh}, ${auth})
    ON CONFLICT (endpoint) DO UPDATE SET device_id = EXCLUDED.device_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
  return { ok: true };
});

export const DELETE = handler(async (dev, b) => {
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${String(b?.endpoint ?? "")} AND device_id = ${dev}`;
  return { ok: true };
});
