import type { Metadata } from "next";
import Link from "next/link";
import { deviceId, isPremium } from "@/lib/device";
import { selectedPlats } from "@/lib/prefs";
import { followedIds, newArrivals, providerList, topRated, upcoming, type Card } from "@/lib/queries";
import { continueWatching, newCounts } from "@/lib/extra";
import { activePromo } from "@/lib/promo";
import PromoTile from "@/components/PromoTile";
import { daysUntil, epCode, fmtDate, hue, img, rel, todayISO, tone } from "@/lib/format";
import { fmt, plural } from "@/lib/i18n";
import { page, titleHref, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";
import { platformStyle } from "@/lib/platforms";
import { Fallback, Thumb, followHint } from "@/components/Poster";
import FollowButton from "@/components/FollowButton";
import AdSlot from "@/components/AdSlot";
import { Arrow } from "@/components/icons";
import MarkWatched from "@/components/home/MarkWatched";
import HomePlatforms, { type HPItem, type HPProv } from "@/components/home/HomePlatforms";
import HomeTop10 from "@/components/home/HomeTop10";
import { tvBestToday, tvHasData, tvTime } from "@/lib/tvguide";
import { ALL_LOCALES, type Lang } from "@/lib/locales";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { lang } = await page(params);
  return { alternates: alternates(lang, () => "/") };
}

/** Kedy titul pribudol: Dnes / Včera / Po. */
function ago(date: Date, lang: Lang, d: { today: string; yesterday: string }) {
  const days = Math.floor((Date.now() - date.getTime()) / 86400_000);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (days <= 0) return cap(d.today);
  if (days === 1) return cap(d.yesterday);
  return cap(date.toLocaleDateString(ALL_LOCALES[lang].intl, { weekday: "short" }).replace(".", ""));
}

export default async function Home({ params }: { params: LangParams }) {
  const { lang, d, ctx, h } = await page(params);
  const dev = await deviceId();
  const plats = await selectedPlats(ctx.region);
  const today = todayISO();
  const [up, topTv, topMovies, fol, premium, provs, cont, hasTv] = await Promise.all([
    upcoming(ctx, 12, plats),
    topRated(ctx, "tv", 10, plats),
    topRated(ctx, "movie", 10, plats),
    followedIds(dev),
    isPremium(dev),
    providerList(ctx.region, 3),
    dev ? continueWatching(ctx, dev, today, 3) : Promise.resolve([]),
    tvHasData(ctx.region),
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

  // Moje platformy: vybrané v profile, inak 4 najväčšie v krajine.
  const mine = plats.length ? plats.map((id) => provs.find((p) => p.id === id)).filter((p): p is (typeof provs)[number] => !!p) : provs;
  const icons = mine.slice(0, 4);
  const [counts, newLists] = await Promise.all([
    newCounts(ctx.region, icons.map((p) => p.id)),
    Promise.all(icons.map((p) => newArrivals(ctx, { limit: 10, providerId: p.id, days: 14 }))),
  ]);
  const item = (s: Card, sub = ""): HPItem => ({
    id: s.id, name: s.name, href: titleHref(lang, s), poster: img(s.poster_path, "w185"), score: s.score, tone: tone(s.score), ago: sub, hue: hue(s.id),
  });
  const hpProvs: HPProv[] = icons.map((p) => {
    const st = platformStyle(p.name);
    return { id: p.id, name: p.name, slug: p.slug, logo: img(p.logo_path, "w92"), color: st.color, short: st.short, fresh: counts[p.id] ?? 0 };
  });
  const hpItems = Object.fromEntries(icons.map((p, i) => [p.id, newLists[i].map((s) => item(s, ago(s.added, lang, d.time)))]));

  // Tip na večer v TV: najlepší film (inak čokoľvek) a ďalšie tri.
  let tv = hasTv ? await tvBestToday(ctx, "movie", 4) : [];
  if (hasTv && tv.length < 2) tv = await tvBestToday(ctx, "all", 4);
  const intl = ALL_LOCALES[lang].intl;

  const f = up[0] ?? topTv[0] ?? topMovies[0];
  const fd = daysUntil(f.next_air_date);
  const bg = img(f.backdrop_path, "w1280") ?? img(f.poster_path, "w780");
  const week = up.slice(1).filter((s) => (daysUntil(s.next_air_date) ?? 99) <= 7).slice(0, 5);
  const fan = [...topMovies, ...topTv].filter((s) => s.poster_path).slice(0, 3);
  const [c0, ...cRest] = cont;

  return (
    <div className="bento home2">
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

      {c0 && (
        <section className="tile w2 cw">
          <div className="sh"><h2>{d.home.cont}</h2><Link className="slink" href={h("/watchlist")}>{d.home.all} <Arrow /></Link></div>
          <div className="cw-main">
            <Link href={titleHref(lang, c0)} className="cw-poster" aria-label={c0.name}><Thumb s={c0} cls="" /></Link>
            <div className="cw-info">
              <Link href={titleHref(lang, c0)} className="cw-t">{c0.name}</Link>
              <span className="muted">{d.home.next} <b className="fg">{epCode(c0.next_season, c0.next_episode)}</b>{c0.next_name ? ` · ${c0.next_name}` : ""}</span>
              {c0.season_total > 0 && c0.season_total <= 24 ? (
                <div className="cw-dots" aria-hidden="true">
                  {Array.from({ length: c0.season_total }, (_, i) => <i key={i} className={i < c0.season_watched ? "on" : i === c0.season_watched ? "nx" : ""} />)}
                </div>
              ) : (
                <span className="cw-bar" aria-hidden="true"><i style={{ width: `${Math.round((c0.season_watched / Math.max(1, c0.season_total)) * 100)}%` }} /></span>
              )}
              <small className="muted mono">{fmt(d.home.seasonProg, { n: c0.next_season, d: c0.season_watched, t: c0.season_total })}</small>
              <MarkWatched titleId={c0.id} season={c0.next_season} episode={c0.next_episode} />
            </div>
          </div>
          {cRest.length > 0 && (
            <div className="cw-more">
              {cRest.map((s) => (
                <Link key={s.id} href={titleHref(lang, s)} className="cw-mini">
                  <Thumb s={s} cls="" />
                  <span><b>{s.name}</b><small className="mono muted">{epCode(s.next_season, s.next_episode)}</small></span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section className={`tile ${c0 ? "w2" : "w2"} wk`}>
        <div className="sh"><h2>{d.home.thisWeek}</h2><Link className="slink" href={h("/calendar")}>{d.home.calendar} <Arrow /></Link></div>
        {week.length ? (
          <div className="wk-list">
            {week.map((s) => {
              const n = daysUntil(s.next_air_date)!;
              return (
                <Link key={s.id} href={titleHref(lang, s)} className="wk-row">
                  <Thumb s={s} cls="" />
                  <span><b>{s.name}</b><small>{epCode(s.next_ep!.season, s.next_ep!.episode)} · {s.providers[0]?.name ?? ""}</small></span>
                  <span className={`chipday${n <= 1 ? " hot" : ""}`}>{rel(n, lang)}</span>
                </Link>
              );
            })}
          </div>
        ) : <p className="muted">{d.home.nothingThisWeek}</p>}
      </section>

      {hpProvs.length > 0 && <HomePlatforms provs={hpProvs} items={hpItems} />}

      {tv.length > 0 && (
        <section className="tile w4 tvt">
          <Link href={titleHref(lang, tv[0])} className="tvt-hero">
            {img(tv[0].backdrop_path, "w780") ? <img src={img(tv[0].backdrop_path, "w780")!} alt="" loading="lazy" /> : <Fallback id={tv[0].id} />}
            <span className="tvt-shade" />
            <span className="lbl">{d.home.tvTip}</span>
            <span className="tvt-foot">
              <span><b>{tv[0].name}</b><small>{[tv[0].channel, tv[0].kind === "movie" ? d.common.movie : d.common.tv, tv[0].year].filter(Boolean).join(" · ")}</small></span>
              <span className="tvt-time"><b className="mono">{tvTime(tv[0].starts_at, ctx.region, intl)}</b>{tv[0].score != null && <small>{tv[0].score}%</small>}</span>
            </span>
          </Link>
          <div className="tvt-list">
            {tv.slice(1).sort((a, b) => +a.starts_at - +b.starts_at).map((r) => (
              <Link key={r.airing_id} href={titleHref(lang, r)} className="tvt-row">
                <b className="mono">{tvTime(r.starts_at, ctx.region, intl)}</b>
                <span><b>{r.name}</b><small>{r.channel}{r.season && r.episode ? ` · ${epCode(r.season, r.episode)}` : ""}</small></span>
                <span className="mono" style={{ color: tone(r.score) }}>{r.score != null ? `${r.score}%` : ""}</span>
              </Link>
            ))}
            <Link href={h("/tv-program")} className="tvt-all">{d.tvguide.full} <Arrow /></Link>
          </div>
        </section>
      )}

      {(topTv.length > 0 || topMovies.length > 0) && <HomeTop10 tv={topTv.map((s) => item(s))} movie={topMovies.map((s) => item(s))} />}

      {promo && <PromoTile p={promo} label={d.promo.label} />}
      <AdSlot place="home" hidden={premium} />

      <Link href={h("/pick")} className="tile w4 click pfan">
        <span className="pfan-img" aria-hidden="true">
          {fan.map((s, i) => <img key={s.id} src={img(s.poster_path, "w185")!} alt="" loading="lazy" style={{ left: i * 30, top: i === 1 ? 0 : 10, transform: `rotate(${[-8, 0, 8][i]}deg)` }} />)}
        </span>
        <span className="pfan-text">
          <b>{d.home.pickTitle}</b>
          <small>{d.home.pickSub}</small>
          <span className="pfan-btn">{d.home.pickCta}</span>
        </span>
      </Link>
    </div>
  );
}
