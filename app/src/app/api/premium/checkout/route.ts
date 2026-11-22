import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { bad, handler } from "@/lib/api";
import { inApp } from "@/lib/device";
import { premiumEnabled, stripe } from "@/lib/stripe";
import { DEFAULT_LANG, href, isLang } from "@/lib/locales";
import { SITE_URL } from "@/lib/site";

export const POST = handler(async (dev) => {
  if (!premiumEnabled() || !process.env.STRIPE_PRICE_ID) throw bad("Prémium nie je zapnuté");
  if (await inApp()) throw bad("V aplikácii nie je nákup dostupný");
  const l = (await cookies()).get("lang")?.value;
  const lang = isLang(l) ? l : DEFAULT_LANG;
  const [d] = await sql<{ stripe_customer: string | null }[]>`SELECT stripe_customer FROM devices WHERE id = ${dev}`;
  const back = `${SITE_URL}${href(lang, "/profile")}`;
  const s = await stripe<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    line_items: { 0: { price: process.env.STRIPE_PRICE_ID, quantity: 1 } },
    client_reference_id: dev,
    customer: d?.stripe_customer ?? undefined,
    subscription_data: { metadata: { device: dev } },
    metadata: { device: dev },
    allow_promotion_codes: "true",
    locale: lang === "sk" ? "sk" : lang === "cs" ? "cs" : lang === "pl" ? "pl" : lang === "hu" ? "hu" : lang === "de" ? "de" : "en",
    success_url: `${back}?premium=ok`,
    cancel_url: back,
  });
  return { url: s.url };
});
