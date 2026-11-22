import Script from "next/script";

/**
 * Reklamný blok Google AdSense. Zobrazí sa len, ak je nastavené ADSENSE_CLIENT
 * a ID bloku a návštevník nemá prémium. Súhlas s cookies rieši Google (CMP).
 */
export default function AdSlot({ place, slot, hidden = false }: { place: string; slot?: string; hidden?: boolean }) {
  const client = process.env.ADSENSE_CLIENT;
  const id = slot ?? process.env.ADSENSE_SLOT;
  if (!client || !id || hidden) return null;
  return (
    <div className="tile w4 ad">
      <ins className="adsbygoogle" style={{ display: "block", width: "100%" }} data-ad-client={client} data-ad-slot={id} data-ad-format="auto" data-full-width-responsive="true" />
      <Script id={`ad-${place}`} strategy="afterInteractive">{`(window.adsbygoogle=window.adsbygoogle||[]).push({});`}</Script>
    </div>
  );
}
