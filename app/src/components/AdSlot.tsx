import Script from "next/script";

/**
 * Reklamný blok Google AdSense. Zobrazí sa len, ak je nastavené
 * ADSENSE_CLIENT (ca-pub-…) a ID bloku. Inak sa nevykreslí nič.
 */
export default function AdSlot({ slot, className = "" }: { slot?: string; className?: string }) {
  const client = process.env.ADSENSE_CLIENT;
  const id = slot ?? process.env.ADSENSE_SLOT;
  if (!client || !id) return null;
  return (
    <div className={`tile w4 ad ${className}`}>
      <ins className="adsbygoogle" style={{ display: "block", width: "100%" }} data-ad-client={client} data-ad-slot={id} data-ad-format="auto" data-full-width-responsive="true" />
      <Script id={`ad-${id}`} strategy="afterInteractive">{`(window.adsbygoogle=window.adsbygoogle||[]).push({});`}</Script>
    </div>
  );
}
