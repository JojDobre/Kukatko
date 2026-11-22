import type { Metadata } from "next";
import Link from "next/link";
import { deviceId, isPremium } from "@/lib/device";
import { selectedPlats } from "@/lib/prefs";
import { followed, followedIds, newArrivals, providerList, topRated, upcoming } from "@/lib/queries";
import { activePromo } from "@/lib/promo";
import PromoTile from "@/components/PromoTile";
import { platformStyle } from "@/lib/platforms";
import { daysUntil, epCode, fmtDate, img, rel, todayISO, tone } from "@/lib/format";
import { plural } from "@/lib/i18n";
import { page, titleHref, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";
import Poster, { Fallback, Thumb, followHint } from "@/components/Poster";
import FollowButton from "@/components/FollowButton";
import AdSlot from "@/components/AdSlot";
import { Bell } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { lang } = await page(params);
  return { alternates: alternates(lang, () => "/") };
}

export default async function Home({ params }: { params: LangParams }) {
  const { lang, d, ctx, h } = await page(params);
  const dev = await deviceId();
  const plats = await selectedPlats(ctx.region);
  const [up, topTv, topMovies, fresh, fol, mine, premium, provs] = await Promise.all([
    upcoming(ctx, 12, plats),
    topRated(ctx, "tv", 12, plats),
    topRated(ctx, "movie", 12, plats),
    newArrivals(ctx, { limit: 12, providers: plats }),
    followedIds(dev),
    dev ? followed(ctx, dev) : Promise.resolve([]),
    isPremium(dev),
    providerList(ctx.region, 3),
  ]);
  const promo = premium ? null : await activePromo(lang);

  if (!up.length && !topTv.length && !topMovies.length) {
    return (
      <section className="tile">
        <h1 style={{ fontSize: 26 }}>{d.home.preparingTitle}</h1>
        <p className="muted">{d.home.preparingText}</p>
      </section>
    );
  }

  const f = up[0] ?? topTv[0] ?? topMovies[0];
  const fd = daysUntil(f.next_air_date);
  const bg = img(f.backdrop_path, "w1280") ?? img(f.poster_path, "w780");
  const week = up.slice(1).filter((s) => (daysUntil(s.next_air_date) ?? 99) <= 7).slice(0, 4);
  const best = [...topTv, ...topMovies].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  return (
    <div className="bento">
      <div className="tile feature w2 h2">
        <Link href={titleHref(lang, f)} className="stretch" aria-label={f.name} />
        <Fallback id={f.id} />
        {bg && <img className="bgp" src={bg} alt="" fetchPriority="high" />}
        <span className="shade" />
        <span className="lbl"><span>{f.next_ep ? d.home.nextPremiere : d.home.topRated}</span><span>{f.providers[0]?.name ?? ""}</span></span>
        <h1 className="fh">{f.name}</h1>
        {f.next_ep && <p>{epCode(f.next_ep.season, f.next_ep.episode)}{f.next_ep_name ? ` · ${f.next_ep_name}` : ""}</p>}
        {f.next_ep && fd != null && (
          <div className="when">
            <div><b>{fd === 0 ? d.home.todayBig : fd}</b><small>{fd === 0 ? d.home.releasesToday : plural(d.common.days, fd, lang)}</small></div>
            <div><b>{fmtDate(f.next_air_date, lang)}</b><small>{d.home.releaseDate}</small></div>
          </div>
        )}
        <div className="frow"><FollowButton titleId={f.id} name={f.name} initial={fol.has(f.id)} variant="ghost" hint={followHint(f, lang)} /></div>
      </div>

      <div className="tile w2">
        <div className="lbl"><span>{d.home.thisWeek}</span><span>{fmtDate(todayISO(), lang)}</span></div>
        {week.length ? week.map((s) => {
          const n = daysUntil(s.next_air_date)!;
          return (
            <Link key={s.id} href={titleHref(lang, s)} className="wrow">
              <Thumb s={s} />
              <span><b>{s.name}</b><small>{epCode(s.next_ep!.season, s.next_ep!.episode)} · {s.providers[0]?.name ?? ""}</small></span>
              <span className={`chipday${n <= 1 ? " hot" : ""}`}>{rel(n, lang)}</span>
            </Link>
          );
        }) : <p className="muted">{d.home.nothingThisWeek}</p>}
      </div>

      <Link href={h("/watchlist")} className="tile click">
        <div className="lbl"><span>{d.home.watching}</span><Bell size={16} /></div>
        <div className="big">{mine.length}<small> {plural(d.common.titles, mine.length, lang).replace(/^\d+\s*/, "")}</small></div>
        <div className="stack">{mine.slice(0, 5).map((s) => <Thumb key={s.id} s={s} cls="" />)}</div>
      </Link>

      {best && (
        <Link href={titleHref(lang, best)} className="tile click">
          <div className="lbl"><span>{d.home.bestRated}</span></div>
          <b style={{ fontSize: 17, lineHeight: 1.2 }}>{best.name}</b>
          <div className="ring" style={{ background: `conic-gradient(${tone(best.score)} ${best.score ?? 0}%, var(--tile2) 0)` }}><b>{best.score}</b></div>
        </Link>
      )}

      <Link href={h("/pick")} className="tile w2 click pickt">
        <span className="lbl"><span>{d.more.pick}</span></span>
        <h2>{d.pick.title}</h2>
        <p>{d.pick.metaDesc}</p>
        <span className="btn">{d.pick.cta}</span>
      </Link>

      <div className="tile w2">
        <div className="lbl"><span>{d.more.platforms}</span><Link className="link" href={h("/calendar")}>{d.more.calendar} →</Link></div>
        <div className="chartlinks">
          {provs.slice(0, 8).map((p) => <Link key={p.id} className="chip" href={h(`/platform/${p.slug}`)}><span className="pdot" style={{ background: platformStyle(p.name).color }} />{p.name}</Link>)}
          <Link className="chip" href={h("/platforms")}>{d.platform.all} →</Link>
        </div>
      </div>

      {promo && <PromoTile p={promo} label={d.promo.label} />}

      {fresh.length > 0 && (
        <div className="tile w4">
          <div className="cathead"><h2>{d.home.newOnPlatforms}</h2><Link href={h("/charts")} className="btn soft">{d.nav.charts}</Link></div>
          <div className="posters row">{fresh.map((s) => <Poster key={s.id} s={s} lang={lang} followed={fol.has(s.id)} />)}</div>
        </div>
      )}

      <AdSlot place="home" hidden={premium} />

      {[{ list: topTv, title: d.home.topTv, kind: "tv" }, { list: topMovies, title: d.home.topMovies, kind: "movie" }].map((sec) => sec.list.length > 0 && (
        <div key={sec.kind} className="tile w4">
          <div className="cathead">
            <h2>{sec.title}{plats.length ? ` ${d.home.onYourPlatforms}` : ""}</h2>
            <Link href={h(`/catalog${sec.kind === "movie" ? "?kind=movie" : ""}`)} className="btn soft">{d.home.fullCatalog}</Link>
          </div>
          <div className="posters">{sec.list.map((s, i) => <Poster key={s.id} s={s} lang={lang} followed={fol.has(s.id)} priority={i < 4} />)}</div>
        </div>
      ))}
    </div>
  );
}
