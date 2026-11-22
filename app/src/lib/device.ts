import { cookies } from "next/headers";
import { sql } from "./db";
import { DEFAULT_LANG, isLang, regionOf } from "./locales";

export const DEVICE_COOKIE = "kid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id zariadenia z cookie (nastavuje ho proxy.ts). Bez registrácie. */
export async function deviceId(): Promise<string | null> {
  const v = (await cookies()).get(DEVICE_COOKIE)?.value;
  return v && UUID.test(v) ? v : null;
}

export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

/** Pre API: vráti id, zabezpečí, že zariadenie existuje, a zapamätá si jeho jazyk. */
export async function ensureDevice(): Promise<string> {
  const jar = await cookies();
  const id = jar.get(DEVICE_COOKIE)?.value;
  if (!id || !UUID.test(id)) throw new Response("Chýba cookie zariadenia", { status: 400 });
  const l = jar.get("lang")?.value;
  const lang = isLang(l) ? l : DEFAULT_LANG;
  await sql`INSERT INTO devices (id, lang, region) VALUES (${id}, ${lang}, ${regionOf(lang)})
    ON CONFLICT (id) DO UPDATE SET last_seen = now(), lang = EXCLUDED.lang, region = EXCLUDED.region`;
  return id;
}

/** Je zariadenie prémiové? */
export async function isPremium(id: string | null) {
  if (!id || process.env.PREMIUM_ENABLED !== "true") return false;
  const [r] = await sql<{ ok: boolean }[]>`SELECT premium_until > now() AS ok FROM devices WHERE id = ${id}`;
  return !!r?.ok;
}

/** Beží stránka v Android appke (TWA)? Tam neukazujeme nákup prémia (pravidlá Google Play). */
export async function inApp() {
  return (await cookies()).get("app")?.value === "1";
}
