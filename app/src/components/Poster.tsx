import Link from "next/link";
import type { Card } from "@/lib/queries";
import { daysUntil, epCode, hue, img, rel, tone } from "@/lib/format";
import { platformStyle } from "@/lib/platforms";
import { dict, fmt } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import { titleHref } from "@/lib/page";
import FollowButton from "./FollowButton";

export type Metric = "score" | "imdb" | "tmdb" | "rt" | "users";

export function metricValue(s: Card, m: Metric): { text: string; v: number | null } {
  switch (m) {
    case "imdb": return { text: s.imdb_rating != null ? s.imdb_rating.toFixed(1) : "–", v: s.imdb_rating != null ? s.imdb_rating * 10 : null };
    case "tmdb": return { text: s.tmdb_rating != null ? s.tmdb_rating.toFixed(1) : "–", v: s.tmdb_rating != null ? s.tmdb_rating * 10 : null };
    case "rt": return { text: s.rt_rating != null ? `${s.rt_rating}%` : "–", v: s.rt_rating };
    case "users": return s.user_count >= 5 && s.user_avg != null ? { text: `${Math.round(s.user_avg * 10)}%`, v: s.user_avg * 10 } : { text: "–", v: null };
    default: return { text: s.score != null ? `${s.score}%` : "–", v: s.score };
  }
}

export function Fallback({ id }: { id: number }) {
  const h = hue(id);
  return <span aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, background: `linear-gradient(150deg,hsl(${h} 70% 50%),hsl(${(h + 35) % 360} 65% 24%))` }} />;
}

export function Thumb({ s, cls = "mini" }: { s: { id: number; poster_path: string | null }; cls?: string }) {
  return s.poster_path
    ? <img className={cls} src={img(s.poster_path, "w185")!} alt="" loading="lazy" />
    : <span className={cls} style={{ position: "relative", overflow: "hidden" }}><Fallback id={s.id} /></span>;
}

/** Text do hlášky po kliknutí na zvonček. */
export function followHint(s: Pick<Card, "kind" | "next_ep" | "next_air_date">, lang: Lang) {
  const d = dict(lang).follow;
  if (s.kind === "movie") return d.toastMovie;
  if (!s.next_ep || !s.next_air_date) return d.toastSeason;
  return fmt(d.toastEp, { when: rel(daysUntil(s.next_air_date), lang), ep: epCode(s.next_ep.season, s.next_ep.episode) });
}

export default function Poster({ s, lang, followed, metric = "score", priority = false, note }: {
  s: Card; lang: Lang; followed: boolean; metric?: Metric; priority?: boolean; note?: React.ReactNode;
}) {
  const m = metricValue(s, metric);
  const days = daysUntil(s.next_air_date);
  const src = img(s.poster_path, "w342");
  return (
    <div className="pc">
      <Link href={titleHref(lang, s)} className="pimg" aria-label={s.name}>
        <Fallback id={s.id} />
        {src && <img src={src} alt="" loading={priority ? "eager" : "lazy"} decoding="async" />}
        <span className="sc"><i style={{ background: tone(m.v) }} />{m.text}</span>
        <span className="pt">{s.name}</span>
      </Link>
      <FollowButton titleId={s.id} name={s.name} initial={followed} variant="icon" hint={followHint(s, lang)} />
      <div className="pm">
        {s.providers.slice(0, 3).map((p) => {
          const st = platformStyle(p.name);
          return <span key={p.id} className="pl" style={{ background: st.color }} title={p.name}>{st.short}</span>;
        })}
        {note ?? (s.next_ep && days != null && days >= 0
          ? <span className="nx">{epCode(s.next_ep.season, s.next_ep.episode)} {rel(days, lang)}</span>
          : <span>{s.year ?? ""}{s.kind === "movie" ? ` · ${dict(lang).common.movie}` : ""}</span>)}
      </div>
    </div>
  );
}
