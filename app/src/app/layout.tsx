import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import { Geist_Mono, Onest } from "next/font/google";
import "./globals.css";
import { TabBar, TopNav } from "@/components/Nav";
import Toaster from "@/components/Toaster";
import SWRegister from "@/components/SWRegister";
import { deviceId } from "@/lib/device";
import { sql } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { SITE, SITE_URL } from "@/lib/site";

const onest = Onest({ subsets: ["latin", "latin-ext"], variable: "--font-onest", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin", "latin-ext"], weight: ["500", "700"], variable: "--font-mono", display: "swap" });


export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE}: kde pozerať seriály`, template: `%s | ${SITE}` },
  description: "Zisti, kde sa dá seriál pozrieť na Netflixe, HBO Max, Disney+, Voyo a ďalších. Hodnotenia z IMDb, TMDB a Rotten Tomatoes na jednom mieste a upozornenia na nové epizódy.",
  applicationName: SITE,
  appleWebApp: { capable: true, title: SITE, statusBarStyle: "default" },
  openGraph: { siteName: SITE, locale: "sk_SK", type: "website" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEEEF2" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0C10" },
  ],
};

async function badgeCount() {
  const id = await deviceId();
  if (!id) return 0;
  try {
    const [r] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM follows f JOIN shows s ON s.id = f.show_id
      WHERE f.device_id = ${id} AND s.next_air_date BETWEEN ${todayISO()}::date AND ${todayISO()}::date + 7`;
    return r.n;
  } catch { return 0; }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const badge = await badgeCount();
  const adsense = process.env.ADSENSE_CLIENT;
  return (
    <html lang="sk" className={`${onest.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Zvolený motív nastavíme ešte pred vykreslením, aby stránka nezablikala. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}` }} />
        {adsense && <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`} crossOrigin="anonymous" strategy="afterInteractive" />}
      </head>
      <body>
        <div className="app">
          <header className="head">
            <Link href="/" className="logo"><i aria-hidden="true" />{SITE}</Link>
            <TopNav badge={badge} />
          </header>
          {children}
          <footer className="foot">
            <span>
              Dáta o seriáloch: <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>.
              Tento produkt používa TMDB API, ale nie je schválený ani certifikovaný spoločnosťou TMDB.
              Dostupnosť na platformách: <a href="https://www.justwatch.com" target="_blank" rel="noopener">JustWatch</a>.
            </span>
            <span><Link href="/o-stranke">O stránke a súkromie</Link></span>
          </footer>
        </div>
        <TabBar />
        <Toaster />
        <SWRegister />
      </body>
    </html>
  );
}
