import webpush from "web-push";
import { sql } from "../src/lib/db";
import { epCode, todayISO } from "../src/lib/format";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

type Job = { device_id: string; show_id: number; key: string; title: string; body: string; url: string; image: string | null };

function setupPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? `https://${process.env.DOMAIN ?? "localhost"}`, pub, priv);
  return true;
}

/**
 * Nájde, komu treba poslať upozornenie:
 *  - vyšla epizóda sledovaného seriálu (dnes alebo včera, ak sme ju ešte neposlali),
 *  - bola ohlásená nová sezóna (next_ep je 1. epizóda).
 */
export async function findJobs(): Promise<Job[]> {
  const today = todayISO();
  const rows = await sql<{
    device_id: string; show_id: number; name: string; slug: string; poster_path: string | null;
    last_ep: any; next_ep: any; prefs: { episodes?: boolean; seasons?: boolean };
  }[]>`
    SELECT f.device_id, s.id AS show_id, s.name, s.slug, s.poster_path, s.last_ep, s.next_ep, d.prefs
    FROM follows f JOIN shows s ON s.id = f.show_id JOIN devices d ON d.id = f.device_id
    WHERE EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.device_id = f.device_id)
      AND ( (s.last_ep->>'air_date')::date BETWEEN ${today}::date - 1 AND ${today}::date
         OR (s.next_ep->>'episode')::int = 1 )`;

  const jobs: Job[] = [];
  for (const r of rows) {
    const url = `/serial/${r.show_id}-${r.slug}`;
    const image = r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null;
    const ep = r.last_ep;
    if (r.prefs.episodes !== false && ep?.air_date && ep.air_date >= shift(today, -1) && ep.air_date <= today) {
      const code = epCode(ep.season, ep.episode);
      jobs.push({ device_id: r.device_id, show_id: r.show_id, key: `ep:${code}`, url, image,
        title: `${r.name}: nová epizóda`, body: `${code}${ep.name ? " · " + ep.name : ""} je vonku.` });
    }
    const nx = r.next_ep;
    if (r.prefs.seasons !== false && nx?.episode === 1) {
      const when = nx.air_date ? new Date(nx.air_date + "T12:00:00Z").toLocaleDateString("sk-SK", { day: "numeric", month: "long", timeZone: "UTC" }) : "čoskoro";
      jobs.push({ device_id: r.device_id, show_id: r.show_id, key: `season:${nx.season}`, url, image,
        title: `${r.name}: ${nx.season}. sezóna`, body: `Premiéra ${nx.air_date ? when : "bude čoskoro"}. Pripomenieme ti ju.` });
    }
  }
  return jobs;
}

function shift(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function sendNotifications() {
  if (!setupPush()) return log("VAPID kľúče chýbajú, push upozornenia preskakujem (npm run vapid)");
  const jobs = await findJobs();
  let sent = 0;
  for (const j of jobs) {
    // Najprv si zapíšeme, že posielame. Ak už záznam existuje, preskočíme.
    const ins = await sql`INSERT INTO notifications_sent (device_id, show_id, key)
      VALUES (${j.device_id}, ${j.show_id}, ${j.key}) ON CONFLICT DO NOTHING RETURNING 1`;
    if (!ins.length) continue;
    const subs = await sql<{ endpoint: string; p256dh: string; auth: string }[]>`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE device_id = ${j.device_id}`;
    const payload = JSON.stringify({ title: j.title, body: j.body, url: j.url, image: j.image, tag: `${j.show_id}:${j.key}` });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
        } else log("Push zlyhal:", e?.statusCode ?? e?.message);
      }
    }
  }
  log(`Upozornenia: ${jobs.length} kandidátov, odoslaných ${sent}`);
}
