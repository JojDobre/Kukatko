import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { handler } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

/** Vráti (prípadne vytvorí) súkromný odkaz na kalendár zariadenia. */
export const POST = handler(async (dev) => {
  const [r] = await sql<{ ical_token: string | null }[]>`SELECT ical_token FROM devices WHERE id = ${dev}`;
  let token = r?.ical_token;
  if (!token) {
    token = randomBytes(18).toString("base64url");
    await sql`UPDATE devices SET ical_token = ${token} WHERE id = ${dev}`;
  }
  const https = `${SITE_URL}/api/ical/${token}.ics`;
  return { https, webcal: https.replace(/^https?:/, "webcal:") };
}, { limit: [20, 600] });
