import { createHmac, timingSafeEqual } from "node:crypto";

/** Malý klient Stripe API (bez SDK). Prémium je predvolene vypnuté: PREMIUM_ENABLED=true ho zapne. */
export const premiumEnabled = () => process.env.PREMIUM_ENABLED === "true" && !!process.env.STRIPE_SECRET_KEY;

function form(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe<T = any>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? form(body) : undefined,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${j?.error?.message ?? ""}`);
  return j as T;
}

/** Overí podpis webhooku (hlavička Stripe-Signature). */
export function verifyWebhook(raw: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

/** Koniec zaplateného obdobia (podporuje staré aj nové verzie Stripe API). */
export function periodEnd(sub: any): Date | null {
  const t = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return t ? new Date(t * 1000) : null;
}
