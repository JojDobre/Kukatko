import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { Geist_Mono, Onest } from "next/font/google";
import "../globals.css";
import { TabBar, TopNav } from "@/components/Nav";
import Toaster from "@/components/Toaster";
import SWRegister from "@/components/SWRegister";
import PrivacyLink from "@/components/PrivacyLink";
import { I18nProvider } from "@/components/I18n";
import { deviceId, isPremium } from "@/lib/device";
import { sql } from "@/lib/db";
import { addDaysISO, todayISO } from "@/lib/format";
import { SITE, SITE_URL } from "@/lib/site";
import { ALL_LOCALES, DEFAULT_LANG, LANGS, href, isLang, type Lang } from "@/lib/locales";
import { dict } from "@/lib/i18n";

const onest = Onest({ subsets: ["latin", "latin-ext"], variable: "--font-onest", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin", "latin-ext"], weight: ["500", "700"], variable: "--font-mono", display: "swap" });

type P = { params: Promise<{ lang: string }> };

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const d = dict(lang);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${SITE}: ${d.meta.tagline}`, template: `%s | ${SITE}` },
    description: d.meta.description,
    applicationName: SITE,
    appleWebApp: { capable: true, title: SITE, statusBarStyle: "default" },
    openGraph: { siteName: SITE, locale: ALL_LOCALES[lang].og, type: "website" },
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEEEF2" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0C10" },
  ],
};

async function badgeCount(id: string | null) {
  if (!id) return 0;
  try {
    const today = todayISO();
    const [r] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM follows f JOIN titles t ON t.id = f.title_id
      WHERE f.device_id = ${id} AND t.next_air_date BETWEEN ${today} AND ${addDaysISO(today, 7)}`;
    return r.n;
  } catch { return 0; }
}

export default async function LangLayout({ children, params }: P & { children: React.ReactNode }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const d = dict(lang);
  const dev = await deviceId();
  const [badge, premium] = await Promise.all([badgeCount(dev), isPremium(dev)]);
  const adsense = !premium ? process.env.ADSENSE_CLIENT : undefined;
  const umami = process.env.UMAMI_SCRIPT_URL && process.env.UMAMI_WEBSITE_ID;
  // Do prehliadača posielame len texty, ktoré používajú klientské komponenty.
  const { about: _a, notify: _n, meta: _m, person: _p, charts: _c, notFound: _nf, ...clientD } = d;
  const i18n = { lang, d: clientD as typeof d, defaultLang: DEFAULT_LANG, langs: LANGS.map((code: Lang) => ({ code, name: ALL_LOCALES[code].name })) };

  return (
    <html lang={lang} className={`${onest.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Zvolený motív nastavíme pred vykreslením, aby stránka nezablikala. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}` }} />
        {adsense && <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`} crossOrigin="anonymous" strategy="afterInteractive" />}
        {umami && <Script defer src={process.env.UMAMI_SCRIPT_URL} data-website-id={process.env.UMAMI_WEBSITE_ID} strategy="afterInteractive" />}
      </head>
      <body>
        <I18nProvider value={i18n}>
          <div className="app">
            <header className="head">
              <Link href={href(lang, "/")} className="logo"><i aria-hidden="true" />{SITE}</Link>
              <TopNav badge={badge} />
            </header>
            {children}
            <footer className="foot">
              <span>
                {d.footer.data}: <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>. {d.footer.tmdb}{" "}
                {d.footer.availability}: <a href="https://www.justwatch.com" target="_blank" rel="noopener">JustWatch</a>.
              </span>
              <span className="frow">
                <Link href={href(lang, "/about")}>{d.footer.about}</Link>
                {adsense && <PrivacyLink label={d.footer.privacy} />}
              </span>
            </footer>
          </div>
          <TabBar />
          <Toaster />
          <SWRegister />
        </I18nProvider>
      </body>
    </html>
  );
}
