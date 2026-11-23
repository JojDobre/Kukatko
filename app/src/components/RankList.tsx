import Link from "next/link";
import type { ChartRow, ChartType } from "@/lib/charts";
import { daysUntil, epCode, fmtDate, img, rel, tone } from "@/lib/format";
import { dict, fmt } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import { platformStyle } from "@/lib/platforms";
import { titleHref } from "@/lib/page";
import { Fallback, followHint } from "./Poster";
import FollowButton from "./FollowButton";

/** Rebríček ako zoznam cez celú šírku: poradie, plagát, názov, platformy, skóre. */
export default function RankList({ rows, lang, type, followed, genres }: {
  rows: ChartRow[]; lang: Lang; type: ChartType; followed: Set<number>; genres: Record<string, string>;
}) {
  const d = dict(lang);
  const ranked = !["this-week", "new", "leaving"].includes(type);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return (
    <ol className="rank">
      {rows.map((s, i) => {
        const g = s.genre_ids.slice(0, 2).map((id) => genres[`${s.kind}:${id}`]).filter(Boolean).join(", ");
        const nd = daysUntil(s.next_air_date);
        const note = type === "this-week" && s.next_ep && nd != null
          ? <span className="nx">{epCode(s.next_ep.season, s.next_ep.episode)} · {rel(nd, lang)}</span>
          : type === "new" && s.added ? <span className="nx">{fmt(d.charts.added, { date: fmtDate(iso(s.added), lang, { day: "numeric", month: "numeric" }) })}</span>
          : type === "leaving" && s.removed ? <span className="warn">{fmt(d.charts.removed, { p: s.removed_provider ?? "", date: fmtDate(iso(s.removed), lang, { day: "numeric", month: "numeric" }) })}</span>
          : null;
        return (
          <li key={s.id} className={`rrow${ranked && i < 3 ? " top" : ""}`}>
            {ranked ? <span className="rnum mono">{i + 1}</span> : null}
            <Link href={titleHref(lang, s)} className="rthumb" aria-hidden="true" tabIndex={-1}>
              <Fallback id={s.id} />
              {s.poster_path && <img src={img(s.poster_path, "w185")!} alt="" loading={i < 6 ? "eager" : "lazy"} />}
            </Link>
            <div className="rinfo">
              <Link href={titleHref(lang, s)} className="rname">{s.name}</Link>
              <span className="rmeta">{[s.year, s.kind === "movie" ? d.common.movie : d.common.tv, g].filter(Boolean).join(" · ")}</span>
              <span className="pm">
                {s.providers.slice(0, 4).map((p) => { const st = platformStyle(p.name); return <span key={p.id} className="pl" style={{ background: st.color }} title={p.name}>{st.short}</span>; })}
                {note}
              </span>
            </div>
            {s.score != null && (
              <span className="rscore" style={{ background: `conic-gradient(${tone(s.score)} ${s.score}%, var(--tile2) 0)` }}><b className="mono">{s.score}</b></span>
            )}
            <span className="rbell"><FollowButton titleId={s.id} name={s.name} initial={followed.has(s.id)} variant="icon" hint={followHint(s, lang)} /></span>
          </li>
        );
      })}
    </ol>
  );
}
