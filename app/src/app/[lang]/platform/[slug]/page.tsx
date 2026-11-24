import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deviceId } from "@/lib/device";
import { followedIds, newArrivals, providerList, removedRecently, topRated, upcoming, type Ctx } from "@/lib/queries";
import { epCode, img, rel, daysUntil, fmtDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { platformStyle } from "@/lib/platforms";
import { page, titleHref } from "@/lib/page";
import { alternates } from "@/lib/seo";
import { regionName } from "@/lib/locales";
import Poster, { Thumb } from "@/components/Poster";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; slug: string }> };

async function provider(ctx: Ctx, slug: string) {
  const p = (await providerList(ctx.region, 1)).find((x) => x.slug === slug);
  if (!p) notFound();
  return p;
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang, d, ctx } = await page(params);
  const p = await provider(ctx, (await params).slug);
  return {
    title: fmt(d.platform.metaTitle, { p: p.name }),
    description: fmt(d.platform.metaDesc, { p: p.name }),
    alternates: alternates(lang, () => `/platform/${p.slug}`),
  };
}

export default async function PlatformPage({ params }: P) {
  const { lang, d, ctx, h } = await page(params);
  const p = await provider(ctx, (await params).slug);
  const dev = await deviceId();
  const [fresh, gone, week, tv, movies, fol] = await Promise.all([
    newArrivals(ctx, { limit: 18, providerId: p.id, days: 30 }),
    removedRecently(ctx, 12, 30, p.id),
    upcoming(ctx, 10, [p.id], undefined, 7),
    topRated(ctx, "tv", 12, [p.id]),
    topRated(ctx, "movie", 12, [p.id]),
    followedIds(dev),
  ]);
  const st = platformStyle(p.name);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return (
    <div className="bento">
      <section className="tile w4 phead" style={{ background: `linear-gradient(120deg, ${st.color}, color-mix(in srgb, ${st.color} 40%, #000))`, color: "#fff" }}>
        {p.logo_path && <img src={img(p.logo_path, "w92")!} alt="" className="plogo" />}
        <div>
          <h1>{p.name}</h1>
          <p style={{ opacity: .85 }}>{p.count} {d.platform.inCatalog} · {regionName(ctx.region, lang)}</p>
        </div>
      </section>
      {week.length > 0 && (
        <div className="tile w2">
          <div className="lbl"><span>{d.platform.upcoming}</span></div>
          {week.slice(0, 6).map((s) => (
            <Link key={s.id} href={titleHref(lang, s)} className="wrow">
              <Thumb s={s} />
              <span><b>{s.name}</b><small>{epCode(s.next_ep!.season, s.next_ep!.episode)} · {fmtDate(s.next_air_date, lang)}</small></span>
              <span className="chipday">{rel(daysUntil(s.next_air_date), lang)}</span>
            </Link>
          ))}
        </div>
      )}
      {gone.length > 0 && (
        <div className="tile w2">
          <div className="lbl"><span>{d.platform.leaving}</span></div>
          {gone.slice(0, 6).map((s) => (
            <Link key={s.id} href={titleHref(lang, s)} className="wrow">
              <Thumb s={s} />
              <span><b>{s.name}</b><small>{s.kind === "movie" ? d.common.movie : d.common.tv}</small></span>
              <span className="chipday">{fmtDate(iso(s.removed), lang, { day: "numeric", month: "numeric" })}</span>
            </Link>
          ))}
        </div>
      )}
      {fresh.length > 0 && (
        <div className="tile w4">
          <div className="cathead"><h2>{d.platform.newHere}</h2></div>
          <div className="posters row">{fresh.map((s) => <Poster key={s.id} s={s} lang={lang} followed={fol.has(s.id)}
            note={<span className="nx">{fmt(d.charts.added, { date: fmtDate(iso(s.added), lang, { day: "numeric", month: "numeric" }) })}</span>} />)}</div>
        </div>
      )}
      {[{ list: tv, title: d.home.topTv, key: "tv" }, { list: movies, title: d.home.topMovies, key: "movies" }].map((x) => x.list.length > 0 && (
        <div key={x.key} className="tile w4">
          <div className="cathead"><h2>{x.title}</h2><Link className="btn soft" href={h(`/charts/best-${x.key}-${p.slug}`)}>{d.nav.charts}</Link></div>
          <div className="posters">{x.list.map((s) => <Poster key={s.id} s={s} lang={lang} followed={fol.has(s.id)} />)}</div>
        </div>
      ))}
    </div>
  );
}
