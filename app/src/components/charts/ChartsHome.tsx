import Link from "next/link";
import { chartList, daysOnTop } from "@/lib/chartdata";
import { providerList, type Ctx } from "@/lib/queries";
import { dict, fmt } from "@/lib/i18n";
import { hue, img, tone } from "@/lib/format";
import { platformStyle } from "@/lib/platforms";
import { href, type Lang } from "@/lib/locales";
import { titleHref } from "@/lib/page";
import { Arrow, Calendar, Exit, Film, Flame, Sparkle, Star } from "../icons";
import type { Card } from "@/lib/queries";

const Poster = ({ s, w }: { s: Card; w: string }) => {
  const src = img(s.poster_path, w as "w185");
  return src ? <img src={src} alt="" loading="lazy" /> : <span className="fb" style={{ background: `linear-gradient(150deg,hsl(${hue(s.id)} 70% 50%),hsl(${(hue(s.id) + 35) % 360} 65% 24%))` }} />;
};

/** Úvod rebríčkov: najväčší trend, tri rady s veľkými číslami a dlaždice ďalších rebríčkov. */
export default async function ChartsHome({ lang, ctx }: { lang: Lang; ctx: Ctx }) {
  const d = dict(lang);
  const c = d.charts;
  const none = { providers: [] as number[] };
  const [trend, tv, movies, week, fresh, gone, provs] = await Promise.all([
    chartList(ctx, "trending", { ...none, limit: 11 }),
    chartList(ctx, "best-tv", { ...none, limit: 10 }),
    chartList(ctx, "best-movies", { ...none, limit: 10 }),
    chartList(ctx, "this-week", { ...none, limit: 3 }),
    chartList(ctx, "new", { ...none, limit: 3 }),
    chartList(ctx, "leaving", { ...none, limit: 3 }),
    providerList(ctx.region, 3),
  ]);
  const top = trend[0];
  const days = top ? await daysOnTop(ctx.region, "trending", top.id) : 0;
  const ch = (key: string) => href(lang, `/charts/${key}`);

  const row = (title: string, icon: React.ReactNode, color: string, key: string, list: Card[]) => list.length > 0 && (
    <section className="tile w4 chrow">
      <div className="sh"><span className="chname"><span className="chic" style={{ background: color }}>{icon}</span><h2>{title}</h2></span><Link className="slink" href={ch(key)}>{d.home.all} <Arrow /></Link></div>
      <ol className="t10-row">
        {list.slice(0, 10).map((s, i) => (
          <li key={s.id}><Link href={titleHref(lang, s)} aria-label={`${i + 1}. ${s.name}`}>
            <span className="t10-n" aria-hidden="true">{i + 1}</span>
            <span className="t10-img sm"><Poster s={s} w="w185" />{s.score != null && <span className="sc"><i style={{ background: tone(s.score) }} />{s.score}%</span>}</span>
          </Link></li>
        ))}
      </ol>
    </section>
  );
  const tile = (title: string, sub: string, icon: React.ReactNode, color: string, key: string, list: Card[]) => (
    <Link href={ch(key)} className="tile chtile">
      <span className="chic" style={{ background: color }}>{icon}</span>
      <b>{title}</b><small className="muted">{sub}</small>
      {list[0] && <small className="ch1"><span>#1</span> {list[0].name}</small>}
      <span className="chfan" aria-hidden="true">{list.slice(0, 3).reverse().map((s, i) => <span key={s.id} style={{ right: 12 + i * 24, transform: `rotate(${[6, 0, -6][i]}deg)` }}><Poster s={s} w="w92" /></span>)}</span>
    </Link>
  );

  return (
    <div className="bento">
      <h1 className="sr">{c.title}</h1>
      {top && (
        <Link href={titleHref(lang, top)} className="tile w4 chhero">
          {img(top.backdrop_path, "w1280") ? <img src={img(top.backdrop_path, "w1280")!} alt="" /> : <span className="fb" style={{ background: `linear-gradient(150deg,hsl(${hue(top.id)} 70% 45%),hsl(${(hue(top.id) + 35) % 360} 65% 20%))` }} />}
          <span className="tvt-shade" />
          <span className="lbl">{c.trendTop}</span>
          {days >= 2 && <span className="chbadge">{days >= 14 ? fmt(c.weeksTop, { n: Math.floor(days / 7) }) : fmt(c.daysTop, { n: days })}</span>}
          <span className="tvt-foot">
            <span><b>{top.name}</b><small>{[top.kind === "tv" ? d.common.tv : d.common.movie, top.year, top.providers[0]?.name].filter(Boolean).join(" · ")}{top.growth != null && top.growth > 0 ? ` · ${fmt(c.interest, { p: `+${top.growth} %` })}` : ""}</small></span>
            {top.score != null && <span className="tvt-time"><b className="mono">{top.score}%</b></span>}
          </span>
        </Link>
      )}
      {row(c.bestTv, <Star />, "var(--accent)", "best-tv", tv)}
      {row(c.bestMovies, <Film />, "#5B2BE0", "best-movies", movies)}
      {row(c.trending, <Flame />, "#E0452E", "trending", trend.slice(1))}
      <div className="chgrid">
        {tile(c.thisWeek, c.thisWeekSub, <Calendar />, "#16A361", "this-week", week)}
        {tile(d.home.newOnPlatforms, c.newSub, <Sparkle />, "#1399C6", "new", fresh)}
        {tile(c.leaving, c.leavingSub, <Exit />, "#3A3A3C", "leaving", gone)}
        <Link href={href(lang, "/platforms")} className="tile chtile">
          <span className="chic" style={{ background: "#1399C6" }}><Star /></span>
          <b>{c.byPlatform}</b><small className="muted">{c.byPlatformSub}</small>
          <span className="chfan" aria-hidden="true">{provs.slice(0, 3).reverse().map((p, i) => {
            const st = platformStyle(p.name);
            return <span key={p.id} className="lg" style={{ right: 12 + i * 30, transform: `rotate(${[6, 0, -6][i]}deg)`, background: st.color }}>{p.logo_path ? <img src={img(p.logo_path, "w92")!} alt="" /> : st.short}</span>;
          })}</span>
        </Link>
      </div>
    </div>
  );
}
