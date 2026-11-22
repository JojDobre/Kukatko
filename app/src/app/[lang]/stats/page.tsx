import type { Metadata } from "next";
import Link from "next/link";
import { deviceId } from "@/lib/device";
import { stats } from "@/lib/features";
import { fmt } from "@/lib/i18n";
import { ALL_LOCALES } from "@/lib/locales";
import { img } from "@/lib/format";
import { SITE } from "@/lib/site";
import { page, titleHref, type LangParams } from "@/lib/page";
import ShareRecap from "@/components/ShareRecap";
import { Fallback } from "@/components/Poster";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { d } = await page(params);
  return { title: d.stats.title, robots: { index: false } };
}

export default async function Stats({ params, searchParams }: { params: LangParams; searchParams: Promise<{ year?: string }> }) {
  const { lang, d, h } = await page(params);
  const now = new Date().getFullYear();
  const year = Number((await searchParams).year) || now;
  const dev = await deviceId();
  const s = dev ? await stats(dev, lang, year) : null;
  const empty = !s || (s.episodes + s.movies + s.rated === 0);
  const max = Math.max(1, ...(s?.months ?? []).map((m) => m.n));
  const monthLabel = (m: number) => new Date(Date.UTC(2020, m - 1, 1)).toLocaleDateString(ALL_LOCALES[lang].intl, { month: "short", timeZone: "UTC" });

  return (
    <div className="bento">
      <div className="tile w4">
        <div className="cathead">
          <h1>{fmt(d.stats.recap, { year })}</h1>
          <div className="frow">
            {[now - 1, now].map((y) => <Link key={y} className={`ddb${y === year ? " on" : ""}`} href={h(`/stats?year=${y}`)}>{y}</Link>)}
            {!empty && <ShareRecap year={year} title={fmt(d.stats.recapTitle, { year, site: SITE })} />}
          </div>
        </div>
        {empty && <p className="muted">{d.stats.empty}</p>}
      </div>
      {s && !empty && (
        <>
          {[[s.hours, d.stats.hours], [s.episodes, d.stats.episodes], [s.movies, d.stats.movies], [s.rated, d.stats.rated]].map(([v, l]) => (
            <div key={String(l)} className="tile stat"><span className="rv big2">{v}</span><span className="rs">{l}</span></div>
          ))}
          <div className="tile w2">
            <div className="lbl"><span>{d.stats.topGenres}</span></div>
            {s.genres.map(([g, n]) => (
              <div key={g} className="gbar"><span>{g}</span><span className="bar"><i style={{ width: `${(n / s.genres[0][1]) * 100}%` }} /></span><span className="mono muted">{n}</span></div>
            ))}
          </div>
          <div className="tile w2">
            <div className="lbl"><span>{d.stats.byMonth}</span></div>
            <div className="months" role="img" aria-label={d.stats.byMonth}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const n = s.months.find((x) => x.month === m)?.n ?? 0;
                return <div key={m} className="mcol"><span className="mono">{n || ""}</span><i style={{ height: `${(n / max) * 100}%` }} /><small>{monthLabel(m)}</small></div>;
              })}
            </div>
          </div>
          {s.top.length > 0 && (
            <div className="tile w4">
              <div className="lbl"><span>{d.stats.topRated}</span></div>
              <div className="posters">
                {s.top.map((t) => (
                  <Link key={t.id} href={titleHref(lang, t)} className="pc">
                    <span className="pimg"><Fallback id={t.id} />{t.poster_path && <img src={img(t.poster_path, "w342")!} alt="" loading="lazy" />}
                      <span className="sc">{t.value}/10</span><span className="pt">{t.name}</span></span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
