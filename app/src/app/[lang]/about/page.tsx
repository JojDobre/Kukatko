import type { Metadata } from "next";
import { fmt } from "@/lib/i18n";
import { page, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { lang, d } = await page(params);
  return { title: d.footer.about, alternates: alternates(lang, () => "/about") };
}

export default async function About({ params }: { params: LangParams }) {
  const { d } = await page(params);
  const a = d.about;
  const contact = process.env.CONTACT_EMAIL;
  return (
    <div className="bento">
      <article className="tile w4 prose" style={{ gap: 14 }}>
        <h1 style={{ fontSize: 30 }}>{fmt(a.title, { site: SITE })}</h1>
        <p>{fmt(a.p1, { site: SITE })}</p>
        <h2 style={{ fontSize: 20 }}>{a.dataTitle}</h2>
        <p>{a.data}</p>
        <h2 style={{ fontSize: 20 }}>{a.privacyTitle}</h2>
        <p>{a.privacy}</p>
        <p>{a.ads}</p>
        {contact && <p>{fmt(a.contact, { email: contact })}</p>}
      </article>
    </div>
  );
}
