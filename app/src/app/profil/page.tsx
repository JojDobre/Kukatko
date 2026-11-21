import type { Metadata } from "next";
import { deviceId } from "@/lib/device";
import { devicePrefs } from "@/lib/queries";
import Settings from "@/components/Settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profil a upozornenia", robots: { index: false } };

export default async function Profil() {
  const prefs = await devicePrefs(await deviceId());
  return (
    <div className="bento">
      <Settings initial={prefs} />
      <div className="tile w4">
        <div className="lbl"><span>Bez registrácie</span></div>
        <p className="muted">Sledované seriály a nastavenia sa ukladajú k tomuto zariadeniu. Nemusíš sa registrovať a nezbierame e-mail ani meno.</p>
      </div>
    </div>
  );
}
