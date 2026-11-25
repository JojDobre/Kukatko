"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "../I18n";
import { Arrow } from "../icons";

export type HPProv = { id: number; name: string; slug: string; logo: string | null; color: string; short: string; fresh: number };
export type HPItem = { id: number; name: string; href: string; poster: string | null; score: number | null; tone: string; ago: string; hue: number };

/** Domov – Moje platformy: ikony slúžia ako filter, pod nimi novinky vybranej platformy. */
export default function HomePlatforms({ provs, items }: { provs: HPProv[]; items: Record<number, HPItem[]> }) {
  const { d, href, fmt } = useI18n();
  const h = d.home;
  const [sel, setSel] = useState(provs[0]?.id);
  const cur = provs.find((p) => p.id === sel);
  const list = (sel && items[sel]) || [];
  return (
    <section className="tile w4 hp">
      <div className="shw">
        <div className="sh"><h2>{h.myPlats}</h2><Link className="slink" href={href("/platforms")}>{h.allPlats} <Arrow /></Link></div>
        <p className="ssub">{h.myPlatsSub}</p>
      </div>
      <div className="hp-icons" role="tablist" aria-label={h.myPlats}>
        {provs.map((p) => (
          <button key={p.id} role="tab" aria-selected={p.id === sel} className="hp-icon" onClick={() => setSel(p.id)}>
            <span className="hp-logo">
              {p.logo ? <img src={p.logo} alt="" /> : <span style={{ background: p.color }}>{p.short}</span>}
              {p.fresh > 0 && <i className="hp-badge">{p.fresh > 99 ? "99+" : p.fresh}</i>}
            </span>
            <small>{p.name}</small>
          </button>
        ))}
        <Link className="hp-icon" href={href("/profile")}>
          <span className="hp-logo hp-add">+</span><small className="muted">{h.edit}</small>
        </Link>
      </div>
      {cur && (
        <>
          <div className="hp-sep" />
          <div className="sh sm"><b>{fmt(h.newOn, { p: cur.name })}{cur.fresh > 0 && <span className="muted"> · {cur.fresh}</span>}</b>
            <Link className="slink" href={href(`/platform/${cur.slug}`)}>{h.all}</Link></div>
          {list.length ? (
            <div className="prow-sm">
              {list.map((s) => (
                <Link key={s.id} href={s.href} className="psm">
                  <span className="psm-img">
                    {s.poster ? <img src={s.poster} alt="" loading="lazy" /> : <span style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,hsl(${s.hue} 70% 50%),hsl(${(s.hue + 35) % 360} 65% 24%))` }} />}
                    {s.score != null && <span className="sc"><i style={{ background: s.tone }} />{s.score}%</span>}
                  </span>
                  <b>{s.name}</b><small className="muted">{s.ago}</small>
                </Link>
              ))}
            </div>
          ) : <p className="muted">{h.noNewOn}</p>}
        </>
      )}
    </section>
  );
}
