import type { Metadata } from "next";
import Link from "next/link";
import { deviceId } from "@/lib/device";
import { followed, recommended } from "@/lib/queries";
import { daysUntil, epCode, fmtDate, img, rel } from "@/lib/format";
import Poster, { Fallback, showHref } from "@/components/Poster";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sledujem", robots: { index: false } };

export default async function Sledujem() {
  const dev = await deviceId();
  const [mine, rec] = await Promise.all([dev ? followed(dev) : [], recommended(dev, 12)]);
  const up = mine.filter((s) => (daysUntil(s.next_air_date) ?? -1) >= 0);
  const rest = mine.filter((s) => !up.includes(s));
  const ids = new Set(mine.map((s) => s.id));

  return (
    <div className="bento">
      <div className="tile w2">
        <div className="lbl"><span>Najbližšie epizódy</span><span>{up.length}</span></div>
        {up.length ? up.map((s) => {
          const d = daysUntil(s.next_air_date)!;
          return (
            <Link key={s.id} href={showHref(s)} className="wrow">
              {s.poster_path ? <img className="mini" src={img(s.poster_path, "w185")!} alt="" loading="lazy" /> : <span className="mini" style={{ position: "relative", overflow: "hidden" }}><Fallback id={s.id} /></span>}
              <span><b>{s.name}</b><small>{epCode(s.next_ep!.season, s.next_ep!.episode)} · {fmtDate(s.next_air_date)} · {s.providers[0]?.name ?? ""}</small></span>
              <span className={`chipday${d <= 1 ? " hot" : ""}`}>{rel(d)}</span>
            </Link>
          );
        }) : <p className="muted">Zatiaľ nič. Klikni na zvonček na plagáte a ozveme sa, keď vyjde nová epizóda.</p>}
        <Link href="/profil" className="btn soft">Nastaviť upozornenia</Link>
      </div>
      <div className="tile w2">
        <div className="lbl"><span>Čaká sa na novú sezónu</span><span>{rest.length}</span></div>
        {rest.length ? <div className="posters">{rest.map((s) => <Poster key={s.id} s={s} followed />)}</div>
          : <p className="muted">Všetky sledované seriály majú ohlásenú ďalšiu epizódu.</p>}
      </div>
      <div className="tile w4">
        <div className="lbl"><span>{mine.length ? "Mohlo by sa ti páčiť" : "Na začiatok skús"}</span></div>
        <div className="posters">{rec.map((s) => <Poster key={s.id} s={s} followed={ids.has(s.id)} />)}</div>
      </div>
    </div>
  );
}
