import type { Metadata } from "next";
import Link from "next/link";
import { epCode, tone } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { ALL_LOCALES, regionName, regionTz } from "@/lib/locales";
import { page, titleHref, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";
import { tvDay, tvTime } from "@/lib/tvguide";
import type { KindOpt } from "@/lib/queries";
import { Thumb } from "@/components/Poster";

export const dynamic = "force-dynamic";
type SP = Promise<{ day?: string; kind?: string; sort?: string }>;

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { lang, d, ctx } = await page(params);
  return { title: d.tvguide.metaTitle, description: fmt(d.tvguide.intro, { region: regionName(ctx.region, lang) }), alternates: alternates(lang, () => "/tv-program") };
}

export default async function TvProgram({ params, searchParams }: { params: LangParams; searchParams: SP }) {
  const { lang, d, ctx, h } = await page(params);
  const t = d.tvguide;
  const sp = await searchParams;
  const day = Math.min(6, Math.max(0, Number(sp.day) || 0));
  const kind: KindOpt = sp.kind === "tv" || sp.kind === "movie" ? sp.kind : "all";
  const sort = sp.sort === "time" ? "time" : "score";
  const rows = await tvDay(ctx, day, kind, sort);
  const intl = ALL_LOCALES[lang].intl;
  const tz = regionTz(ctx.region);
  const now = Date.now();

  const q = (o: Partial<{ day: number; kind: string; sort: string }>) => {
    const s = new URLSearchParams();
    const v = { day, kind, sort, ...o };
    if (v.day) s.set("day", String(v.day));
    if (v.kind !== "all") s.set("kind", v.kind);
    if (v.sort !== "score") s.set("sort", v.sort);
    return h(`/tv-program${s.size ? `?${s}` : ""}`);
  };
  const dayLabel = (i: number) => i === 0 ? d.time.today : i === 1 ? d.time.tomorrow
    : new Date(now - 5 * 3600_000 + i * 86400_000).toLocaleDateString(intl, { weekday: "short", day: "numeric", month: "numeric", timeZone: tz });
  const kinds = [["all", d.common.everything], ["movie", d.common.movies], ["tv", d.common.tvs]] as const;

  return (
    <div className="bento">
      <div className="tile w4 open tvg">
        <div className="cathead">
          <h1>{t.title}<small>{regionName(ctx.region, lang)}</small></h1>
          <div className="seg" role="group" aria-label={t.byScore}>
            <Link className="segl" aria-current={sort === "score" ? "true" : undefined} href={q({ sort: "score" })}>{t.byScore}</Link>
            <Link className="segl" aria-current={sort === "time" ? "true" : undefined} href={q({ sort: "time" })}>{t.byTime}</Link>
          </div>
        </div>
        <nav className="seg scroll tvdays" aria-label={t.title}>
          {Array.from({ length: 7 }, (_, i) => (
            <Link key={i} className="segl" aria-current={day === i ? "true" : undefined} href={q({ day: i })}>{dayLabel(i)}</Link>
          ))}
        </nav>
        <div className="seg" role="group">
          {kinds.map(([k, l]) => <Link key={k} className="segl" aria-current={kind === k ? "true" : undefined} href={q({ kind: k })}>{l}</Link>)}
        </div>
        {rows.length === 0 && <p className="empty">{fmt(t.empty, { region: regionName(ctx.region, lang) })}</p>}
        <ol className="tvlist">
          {rows.map((r) => {
            const start = +r.starts_at, end = r.ends_at ? +r.ends_at : start + 90 * 60000;
            const live = start <= now && now < end, past = end <= now;
            const meta = [r.channel, r.kind === "tv" ? (r.season && r.episode ? epCode(r.season, r.episode) : d.common.tv) : d.common.movie, r.year].filter(Boolean).join(" · ");
            return (
              <li key={r.airing_id} className={`tvrow${live ? " live" : ""}${past ? " past" : ""}`}>
                <span className="tvtime mono">{tvTime(r.starts_at, ctx.region, intl)}</span>
                <Thumb s={r} />
                <Link href={titleHref(lang, r)} className="tvinfo">
                  <b>{r.name}</b>
                  <small>{live && <span className="tvlive">{t.now}</span>}{meta}</small>
                </Link>
                <span className="tvscore mono" style={{ color: tone(r.score) }}>{r.score != null ? `${r.score}%` : "–"}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
