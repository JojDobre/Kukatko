import webpush from "web-push";
import { sql } from "../src/lib/db";
import { addDaysISO, epCode, fmtDate, todayISO } from "../src/lib/format";
import { DEFAULT_LANG, href, isLang, loc, type Lang } from "../src/lib/locales";
import { dict, fmt } from "../src/lib/i18n";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

export type Job = { device_id: string; title_id: number; key: string; title: string; body: string; url: string; image: string | null };

function setupPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? `https://${process.env.DOMAIN ?? "localhost"}`, pub, priv);
  return true;
}

type Row = {
  device_id: string; title_id: number; kind: "tv" | "movie"; tmdb_id: number; i18n: any; original_name: string; poster_path: string | null;
  lang: string; region: string; prefs: Record<string, boolean>; premium: boolean;
};

const premiumOn = () => process.env.PREMIUM_ENABLED === "true";

function names(r: Row) {
  const lang: Lang = isLang(r.lang) ? r.lang : DEFAULT_LANG;
  const t = r.i18n?.[lang] ?? r.i18n?.en ?? { name: r.original_name, slug: "titul" };
  return { lang, name: t.name as string, url: href(lang, `/${r.kind}/${r.tmdb_id}-${t.slug}`), d: dict(lang) };
}

const image = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w342${p}` : null);

/**
 * Nájde, komu treba poslať upozornenie:
 *  - vyšla epizóda sledovaného seriálu (dnes alebo včera),
 *  - bola ohlásená nová sezóna (ďalšia epizóda je 1.),
 *  - sledovaný titul pribudol na platformu alebo z nej zmizol (v regióne zariadenia),
 *  - prémium: pripomienka večer pred vydaním epizódy.
 */
export async function findJobs(now = new Date()): Promise<Job[]> {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const cols = sql`f.device_id, t.id AS title_id, t.kind, t.tmdb_id, t.i18n, t.original_name, t.poster_path, d.lang, d.region, d.prefs,
    (d.premium_until IS NOT NULL AND d.premium_until > now()) AS premium`;
  const from = sql`FROM follows f JOIN titles t ON t.id = f.title_id JOIN devices d ON d.id = f.device_id`;
  const hasPush = sql`EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.device_id = f.device_id)`;
  const jobs: Job[] = [];

  // Epizódy, sezóny a pripomienky.
  const eps = await sql<(Row & { last_ep: any; next_ep: any; ep_names: any; next_names: any })[]>`
    SELECT ${cols}, t.last_ep, t.next_ep,
      (SELECT e.names FROM episodes e WHERE e.title_id = t.id AND e.season = (t.last_ep->>'season')::int AND e.episode = (t.last_ep->>'episode')::int) AS ep_names,
      (SELECT e.names FROM episodes e WHERE e.title_id = t.id AND e.season = (t.next_ep->>'season')::int AND e.episode = (t.next_ep->>'episode')::int) AS next_names
    ${from} WHERE ${hasPush} AND t.kind = 'tv' AND (
      (t.last_ep->>'air_date')::date BETWEEN ${today}::date - 1 AND ${today}::date
      OR (t.next_ep->>'episode')::int = 1
      OR (t.next_ep->>'air_date')::date = ${tomorrow}::date)`;
  for (const r of eps) {
    const { lang, name, url, d } = names(r);
    const ep = r.last_ep;
    if (r.prefs.episodes !== false && ep?.air_date && ep.air_date >= addDaysISO(today, -1) && ep.air_date <= today) {
      const code = epCode(ep.season, ep.episode);
      const epName = r.ep_names?.[lang];
      jobs.push({ device_id: r.device_id, title_id: r.title_id, key: `ep:${code}`, url, image: image(r.poster_path),
        title: fmt(d.notify.epTitle, { name }), body: fmt(d.notify.epBody, { ep: epName ? `${code} · ${epName}` : code }) });
    }
    const nx = r.next_ep;
    if (r.prefs.seasons !== false && nx?.episode === 1) {
      const date = nx.air_date ? fmtDate(nx.air_date, lang, { day: "numeric", month: "long" }) : null;
      jobs.push({ device_id: r.device_id, title_id: r.title_id, key: `season:${nx.season}`, url, image: image(r.poster_path),
        title: fmt(d.notify.seasonTitle, { name, n: nx.season }), body: date ? fmt(d.notify.seasonBody, { date }) : d.notify.seasonSoon });
    }
    // Pripomienka sa posiela večer (od 18:00 v časovom pásme jazyka).
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: loc(lang).tz }).format(now));
    if (premiumOn() && r.premium && r.prefs.reminder !== false && nx?.air_date === tomorrow && hour >= 18) {
      const code = epCode(nx.season, nx.episode);
      const epName = r.next_names?.[lang];
      jobs.push({ device_id: r.device_id, title_id: r.title_id, key: `rem:${code}`, url, image: image(r.poster_path),
        title: fmt(d.notify.reminderTitle, { name }), body: fmt(d.notify.reminderBody, { ep: epName ? `${code} · ${epName}` : code }) });
    }
  }

  // Príchody a odchody z platforiem v regióne zariadenia.
  const av = await sql<(Row & { provider: string; provider_id: number; first_seen: Date; removed_at: Date | null; others: string[] | null })[]>`
    SELECT ${cols}, p.name AS provider, a.provider_id, a.first_seen, a.removed_at,
      (SELECT array_agg(x->>'name') FROM jsonb_array_elements(t.providers->d.region) x) AS others
    ${from}
    JOIN availability a ON a.title_id = t.id AND a.region = d.region
    JOIN providers p ON p.id = a.provider_id
    WHERE ${hasPush} AND ((a.removed_at IS NULL AND NOT a.initial AND a.first_seen > now() - interval '48 hours')
      OR a.removed_at > now() - interval '48 hours')`;
  for (const r of av) {
    if (r.prefs.availability === false) continue;
    const { name, url, d } = names(r);
    if (r.removed_at) {
      const others = (r.others ?? []).filter((o) => o !== r.provider);
      jobs.push({ device_id: r.device_id, title_id: r.title_id, key: `out:${r.region}:${r.provider_id}:${r.removed_at.toISOString().slice(0, 10)}`,
        url, image: image(r.poster_path), title: fmt(d.notify.removedTitle, { name, p: r.provider }),
        body: others.length ? fmt(d.notify.removedElsewhere, { others: others.join(", ") }) : fmt(d.notify.removedBody, { p: r.provider }) });
    } else {
      jobs.push({ device_id: r.device_id, title_id: r.title_id, key: `in:${r.region}:${r.provider_id}:${r.first_seen.toISOString().slice(0, 10)}`,
        url, image: image(r.poster_path), title: fmt(d.notify.arrivedTitle, { name, p: r.provider }), body: d.notify.arrivedBody });
    }
  }
  // „Chcem vidieť“: titul pribudol na platformu zariadenia (ak si platformy vybralo, len na tie).
  const wants = await sql<(Row & { provider: string; provider_id: number; first_seen: Date })[]>`
    SELECT w.device_id, t.id AS title_id, t.kind, t.tmdb_id, t.i18n, t.original_name, t.poster_path, d.lang, d.region, d.prefs,
      false AS premium, p.name AS provider, a.provider_id, a.first_seen
    FROM want w JOIN titles t ON t.id = w.title_id JOIN devices d ON d.id = w.device_id
    JOIN availability a ON a.title_id = t.id AND a.region = d.region
    JOIN providers p ON p.id = a.provider_id
    WHERE EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.device_id = w.device_id)
      AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.device_id = w.device_id AND f.title_id = w.title_id)
      AND a.removed_at IS NULL AND NOT a.initial AND a.first_seen > now() - interval '48 hours'
      AND (coalesce(jsonb_array_length(d.platforms->d.region), 0) = 0 OR (d.platforms->d.region) @> to_jsonb(a.provider_id))`;
  for (const r of wants) {
    if (r.prefs.availability === false) continue;
    const { name, url, d } = names(r);
    jobs.push({ device_id: r.device_id, title_id: r.title_id, key: `want:${r.region}:${r.provider_id}:${r.first_seen.toISOString().slice(0, 10)}`,
      url, image: image(r.poster_path), title: fmt(d.notify.arrivedTitle, { name, p: r.provider }), body: `${d.want.list} · ${d.notify.arrivedBody}` });
  }
  return jobs;
}

export async function sendNotifications() {
  if (!setupPush()) return log("VAPID kľúče chýbajú, push upozornenia preskakujem");
  const jobs = await findJobs();
  let sent = 0, skipped = 0;
  for (const j of jobs) {
    // Najprv zapíšeme, že posielame. Ak záznam už existuje, preskočíme.
    const ins = await sql`INSERT INTO notifications_sent (device_id, title_id, key)
      VALUES (${j.device_id}, ${j.title_id}, ${j.key}) ON CONFLICT DO NOTHING RETURNING 1`;
    if (!ins.length) { skipped++; continue; }
    const subs = await sql<{ endpoint: string; p256dh: string; auth: string }[]>`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE device_id = ${j.device_id}`;
    const payload = JSON.stringify({ title: j.title, body: j.body, url: j.url, image: j.image, tag: `${j.title_id}:${j.key}` });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
        else log("Push zlyhal:", e?.statusCode ?? e?.message);
      }
    }
  }
  log(`Upozornenia: ${jobs.length} kandidátov, ${skipped} už odoslaných, odoslaných správ ${sent}`);
}
