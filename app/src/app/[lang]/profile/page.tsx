import type { Metadata } from "next";
import { deviceId, inApp } from "@/lib/device";
import { deviceInfo } from "@/lib/queries";
import { fmtDate } from "@/lib/format";
import { page, type LangParams } from "@/lib/page";
import { SITE } from "@/lib/site";
import Settings from "@/components/Settings";
import Transfer from "@/components/Transfer";
import PremiumBox from "@/components/PremiumBox";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { d } = await page(params);
  return { title: d.profile.metaTitle, robots: { index: false } };
}

export default async function Profile({ params, searchParams }: { params: LangParams; searchParams: Promise<{ premium?: string; code?: string }> }) {
  const { lang, d } = await page(params);
  const sp = await searchParams;
  const dev = await deviceId();
  const info = await deviceInfo(dev);
  const premiumEnabled = process.env.PREMIUM_ENABLED === "true" && !!process.env.STRIPE_SECRET_KEY;
  const active = !!info.premiumUntil && info.premiumUntil > new Date();
  // V Android appke nákup neponúkame (Google Play vyžaduje vlastné platby). Zakúpené prémium však platí.
  const showPremium = premiumEnabled && (!(await inApp()) || active);
  return (
    <div className="bento">
      {sp.premium === "ok" && <div className="tile w4 okbox">{d.premium.thanks}</div>}
      <Settings initial={info.prefs} premium={active} premiumEnabled={premiumEnabled} />
      <Transfer initialCode={sp.code} />
      {showPremium && (
        <PremiumBox site={SITE} price={process.env.PREMIUM_PRICE_LABEL ?? "1,99 €"} hasCustomer={info.hasCustomer && !(await inApp())}
          until={active ? fmtDate(info.premiumUntil!.toISOString(), lang, { day: "numeric", month: "long", year: "numeric" }) : null} />
      )}
      <div className="tile w4">
        <div className="lbl"><span>{d.profile.noAccount}</span></div>
        <p className="muted">{d.profile.noAccountText}</p>
      </div>
    </div>
  );
}
