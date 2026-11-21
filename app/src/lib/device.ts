import { cookies } from "next/headers";
import { sql } from "./db";

export const DEVICE_COOKIE = "kid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id zariadenia z cookie (nastavuje ho proxy.ts). Bez registrácie. */
export async function deviceId(): Promise<string | null> {
  const v = (await cookies()).get(DEVICE_COOKIE)?.value;
  return v && UUID.test(v) ? v : null;
}

/** Pre API: vráti id a zabezpečí, že zariadenie existuje v databáze. */
export async function ensureDevice(): Promise<string> {
  const id = await deviceId();
  if (!id) throw new Response("Chýba cookie zariadenia", { status: 400 });
  await sql`INSERT INTO devices (id) VALUES (${id})
    ON CONFLICT (id) DO UPDATE SET last_seen = now()`;
  return id;
}
