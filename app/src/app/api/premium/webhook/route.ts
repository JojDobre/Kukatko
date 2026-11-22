import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { periodEnd, stripe, verifyWebhook } from "@/lib/stripe";

/** Stripe nám tu oznamuje platby a zmeny predplatného. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await req.text();
  if (!secret || !verifyWebhook(raw, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  const ev = JSON.parse(raw);
  const o = ev.data?.object ?? {};
  try {
    if (ev.type === "checkout.session.completed" && o.mode === "subscription") {
      const device = o.client_reference_id ?? o.metadata?.device;
      const sub = o.subscription ? await stripe("GET", `/subscriptions/${o.subscription}`) : null;
      await sql`UPDATE devices SET stripe_customer = ${o.customer}, stripe_subscription = ${o.subscription},
        premium_until = ${periodEnd(sub) ?? new Date(Date.now() + 31 * 864e5)} WHERE id = ${device}`;
    } else if (ev.type?.startsWith("customer.subscription.")) {
      const active = ["active", "trialing", "past_due"].includes(o.status) && ev.type !== "customer.subscription.deleted";
      const until = active ? periodEnd(o) : new Date();
      await sql`UPDATE devices SET premium_until = ${until}, stripe_subscription = ${o.id}
        WHERE id::text = ${o.metadata?.device ?? ""} OR stripe_subscription = ${o.id} OR stripe_customer = ${o.customer}`;
    }
  } catch (e) {
    console.error("Stripe webhook:", e);
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
