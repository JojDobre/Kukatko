/**
 * Obmedzenie počtu požiadaviek z jednej IP adresy (ochrana API pred spamom).
 * Pevné okno v pamäti procesu. Caddy posiela skutočnú IP v X-Forwarded-For.
 */
const hits = new Map<string, { n: number; reset: number }>();

export function allow(key: string, max: number, windowSec: number, now = Date.now()) {
  const h = hits.get(key);
  if (!h || h.reset <= now) {
    hits.set(key, { n: 1, reset: now + windowSec * 1000 });
    if (hits.size > 50000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    return true;
  }
  h.n++;
  return h.n <= max;
}

export function clientIp(h: Headers) {
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}
