import Link from "next/link";
import type { Card } from "@/lib/queries";
import { daysUntil, epCode, hue, img, rel, tone } from "@/lib/format";
import { platformStyle } from "@/lib/platforms";
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

export const showHref = (s: { id: number; slug: string }) => `/serial/${s.id}-${s.slug}`;

export function Fallback({ id }: { id: number }) {
  const h = hue(id);
  return <span aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, background: `linear-gradient(150deg,hsl(${h} 70% 50%),hsl(${(h + 35) % 360} 65% 24%))` }} />;
}

export function nextLabel(s: Pick<Card, "next_ep" | "next_air_date">) {
  if (!s.next_ep || !s.next_air_date) return undefined;
  return `${rel(daysUntil(s.next_air_date))} pri ${epCode(s.next_ep.season, s.next_ep.episode)}`;
}

export default function Poster({ s, followed, metric = "score", priority = false }: { s: Card; followed: boolean; metric?: Metric; priority?: boolean }) {
  const m = metricValue(s, metric);
  const days = daysUntil(s.next_air_date);
  const src = img(s.poster_path, "w342");
  return (
    <div className="pc">
      <Link href={showHref(s)} className="pimg" aria-label={s.name}>
        <Fallback id={s.id} />
        {src && <img src={src} alt="" loading={priority ? "eager" : "lazy"} decoding="async" />}
        <span className="sc"><i style={{ background: tone(m.v) }} />{m.text}</span>
        <span className="pt">{s.name}</span>
      </Link>
      <FollowButton showId={s.id} name={s.name} initial={followed} variant="icon" nextLabel={nextLabel(s)} />
      <div className="pm">
        {s.providers.slice(0, 3).map((p) => {
          const st = platformStyle(p.name);
          return <span key={p.id} className="pl" style={{ background: st.color }} title={p.name}>{st.short}</span>;
        })}
        {s.next_ep && days != null && days >= 0
          ? <span className="nx">{epCode(s.next_ep.season, s.next_ep.episode)} {rel(days)}</span>
          : <span>{s.year ?? ""}</span>}
      </div>
    </div>
  );
}
