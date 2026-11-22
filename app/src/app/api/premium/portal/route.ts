import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { bad, handler } from "@/lib/api";
import { premiumEnabled, stripe } from "@/lib/stripe";
import { DEFAULT_LANG, href, isLang } from "@/lib/locales";
import { SITE_URL } from "@/lib/site";

/** Stránka Stripe na zrušenie alebo zmenu predplatného. */
export const POST = handler(async (dev) => {
  if (!premiumEnabled()) throw bad("Prémium nie je zapnuté");
  const [d] = await sql<{ stripe_customer: string | null }[]>`SELECT stripe_customer FROM devices WHERE id = ${dev}`;
  if (!d?.stripe_customer) throw bad("Bez predplatného");
  const l = (await cookies()).get("lang")?.value;
  const s = await stripe<{ url: string }>("POST", "/billing_portal/sessions", {
    customer: d.stripe_customer, return_url: `${SITE_URL}${href(isLang(l) ? l : DEFAULT_LANG, "/profile")}`,
  });
  return { url: s.url };
});
