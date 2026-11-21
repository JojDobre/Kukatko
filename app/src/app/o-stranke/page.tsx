import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "O stránke a súkromie" };

export default function About() {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <div className="bento">
      <article className="tile w4 prose" style={{ gap: 14 }}>
        <h1 style={{ fontSize: 30 }}>O stránke {SITE}</h1>
        <p>{SITE} ti ukáže, na ktorej streamovacej službe na Slovensku nájdeš seriál, ako ho hodnotia diváci a kritici a kedy vyjde ďalšia epizóda. Nevysielame žiadne videá, iba odkazujeme na oficiálne platformy.</p>
        <h2 style={{ fontSize: 20 }}>Odkiaľ sú dáta</h2>
        <p>Popisy, plagáty, herci a epizódy pochádzajú z TMDB. Tento produkt používa TMDB API, ale nie je schválený ani certifikovaný spoločnosťou TMDB. Informácie o dostupnosti na platformách poskytuje JustWatch. Hodnotenia IMDb a Rotten Tomatoes získavame cez OMDb API.</p>
        <h2 style={{ fontSize: 20 }}>Súkromie</h2>
        <p>Nevyžadujeme registráciu. Tvoje zariadenie dostane náhodný identifikátor uložený v cookie, aby sme si pamätali, čo sleduješ, ako si hodnotil a ktoré platformy máš. Ak zapneš upozornenia, uložíme adresu na doručenie push správ od tvojho prehliadača. Tieto údaje nepredávame.</p>
        <p>Stránka môže zobrazovať reklamy Google AdSense, ktoré môžu používať vlastné cookies. Niektoré odkazy na platformy sú partnerské: ak si cez ne predplatíš službu, môžeme dostať províziu. Teba to nič nestojí.</p>
        {contact && <p>Kontakt: {contact}</p>}
      </article>
    </div>
  );
}
