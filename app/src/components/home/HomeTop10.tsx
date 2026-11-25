"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "../I18n";
import { Arrow } from "../icons";
import type { HPItem } from "./HomePlatforms";

/** Domov – Top 10 s veľkými číslami a prepínačom Seriály / Filmy. */
export default function HomeTop10({ tv, movie }: { tv: HPItem[]; movie: HPItem[] }) {
  const { d, href } = useI18n();
  const [kind, setKind] = useState<"tv" | "movie">(tv.length ? "tv" : "movie");
  const list = kind === "tv" ? tv : movie;
  return (
    <section className="tile w4 t10">
      <div className="sh"><h2>{d.home.topTitle}</h2><Link className="slink" href={href(kind === "tv" ? "/charts/best-tv" : "/charts/best-movies")}>{d.home.chart} <Arrow /></Link></div>
      <div className="seg" role="group">
        <button aria-pressed={kind === "tv"} onClick={() => setKind("tv")}>{d.common.tvs}</button>
        <button aria-pressed={kind === "movie"} onClick={() => setKind("movie")}>{d.common.movies}</button>
      </div>
      <ol className="t10-row">
        {list.map((s, i) => (
          <li key={s.id}>
            <Link href={s.href} aria-label={`${i + 1}. ${s.name}`}>
              <span className="t10-n" aria-hidden="true">{i + 1}</span>
              <span className="t10-img">
                {s.poster ? <img src={s.poster} alt="" loading="lazy" /> : <span style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,hsl(${s.hue} 70% 50%),hsl(${(s.hue + 35) % 360} 65% 24%))` }} />}
                {s.score != null && <span className="sc"><i style={{ background: s.tone }} />{s.score}%</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
