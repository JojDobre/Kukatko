import { cookies } from "next/headers";
import { randomInt } from "node:crypto";
import { sql } from "@/lib/db";
import { handler } from "@/lib/api";
import { DEFAULT_LANG, href, isLang } from "@/lib/locales";
import { SITE_URL } from "@/lib/site";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Vytvorí odkaz „Pozerajte spolu“ (platí 7 dní). */
export const POST = handler(async (dev) => {
  await sql`DELETE FROM pair_codes WHERE expires_at < now()`;
  const [old] = await sql<{ code: string }[]>`SELECT code FROM pair_codes WHERE device_a = ${dev} AND device_b IS NULL AND expires_at > now() + interval '1 day'`;
  let code = old?.code ?? "";
  for (let i = 0; !code && i < 5; i++) {
    const c = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const r = await sql`INSERT INTO pair_codes (code, device_a, expires_at) VALUES (${c}, ${dev}, now() + interval '7 days') ON CONFLICT DO NOTHING RETURNING 1`;
    if (r.length) code = c;
  }
  const l = (await cookies()).get("lang")?.value;
  return { code, url: `${SITE_URL}${href(isLang(l) ? l : DEFAULT_LANG, `/together?code=${code}`)}` };
}, { limit: [20, 600] });
