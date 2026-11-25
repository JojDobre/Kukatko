import type { Metadata } from "next";
import Link from "next/link";
import { deviceId } from "@/lib/device";
import { selectedPlats } from "@/lib/prefs";
import { catalog, followedIds, genreList, isKind, isSort, languageList, PAGE_SIZE, providerList, SORTS, type KindOpt } from "@/lib/queries";
import { page, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";
import { metricValue, Thumb, followHint, type Metric } from "@/components/Poster";
import Filters, { ViewToggle } from "@/components/Filters";
import { catalogQuery, type FilterState } from "@/lib/catalogUrl";
import FollowButton from "@/components/FollowButton";
import { cookies } from "next/headers";
import { hue, img, tone } from "@/lib/format";
import { platformStyle } from "@/lib/platforms";
import { titleHref } from "@/lib/page";

export const dynamic = "force-dynamic";
type SP = Promise<{ kind?: string; sort?: string; genre?: string; page?: string; year?: string; runtime?: string; score?: string; lang?: string; all?: string; view?: string }>;

export async function generateMetadata({ params, searchParams }: { params: LangParams; searchParams: SP }): Promise<Metadata> {
  const { lang, d } = await page(params);
  const sp = await searchParams;
  const k = isKind(sp.kind) ? sp.kind : "all";
  return {
    title: k === "movie" ? `${d.common.movies}: ${d.catalog.title}` : k === "tv" ? `${d.common.tvs}: ${d.catalog.title}` : d.catalog.metaTitle,
    description: d.catalog.metaDesc,
    alternates: alternates(lang, () => `/catalog${k !== "all" ? `?kind=${k}` : ""}`),
    robots: sp.genre || sp.sort || sp.page || sp.year || sp.runtime || sp.score || sp.lang ? { index: false, follow: true } : undefined,
  };
}

export default async function Catalog({ params, searchParams }: { params: LangParams; searchParams: SP }) {
  const { lang, d, ctx, h } = await page(params);
  const sp = await searchParams;
  const kind: KindOpt = isKind(sp.kind) ? sp.kind : "all";
  const sort = isSort(sp.sort) && !(kind !== "tv" && sp.sort === "next") ? sp.sort : "score";
  const genreIds = (sp.genre ?? "").split(".").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 6);
  const pg = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const decade = [2020, 2010, 2000, 1990, 1980, 1970].includes(Number(sp.year)) ? Number(sp.year) : null;
  const runtime = sp.runtime === "short" || sp.runtime === "medium" || sp.runtime === "long" ? sp.runtime : null;
  const minScore = [60, 70, 80, 90].includes(Number(sp.score)) ? Number(sp.score) : null;
  const language = /^[a-z]{2}$/.test(sp.lang ?? "") ? sp.lang! : null;
  const dev = await deviceId();
  const mine = await selectedPlats(ctx.region);
  const all = sp.all === "1";
  const plats = all ? [] : mine;
  const view = sp.view === "list" || sp.view === "grid" ? sp.view : (await cookies()).get("catview")?.value === "list" ? "list" : "grid";
  const [{ rows, total }, provs, genres, langs, fol] = await Promise.all([
    catalog(ctx, { kind, sort, providers: plats, genre: genreIds, page: pg, decade, runtime, minScore, language }),
    providerList(ctx.region),
    genreList(ctx, kind),
    languageList(ctx, kind),
    followedIds(dev),
  ]);
  const metric: Metric = (["imdb", "tmdb", "rt", "users"] as const).includes(sort as any) ? (sort as Metric) : "score";
  const pages = Math.ceil(total / PAGE_SIZE);
  const state: FilterState = { kind, sort, genre: genreIds.length ? genreIds.join(".") : null, year: decade, runtime, score: minScore, lang: language, all, view };
  const link = (p: number) => {
    const q = catalogQuery(state);
    return h(`/catalog${p > 1 ? `${q ? `${q}&` : "?"}page=${p}` : q}`);
  };

  const meta = (s: (typeof rows)[number]) => [s.kind === "tv" ? d.common.tv : d.common.movie, s.year].filter(Boolean).join(" · ");
  return (
    <div className="bento">
      <div className="tile w4 cat2">
        <div className="cat2-head">
          <h1>{d.catalog.title}<small>{total}</small></h1>
          <ViewToggle state={state} />
        </div>
        <Filters state={state} sorts={Object.keys(SORTS)} providers={provs} selected={mine} region={ctx.region} genres={genres} languages={langs} />
        {!rows.length ? <div className="empty">{d.catalog.empty}</div> : view === "grid" ? (
          <div className="cgrid">
            {rows.map((s, i) => {
              const m = metricValue(s, metric);
              const p = s.providers[0];
              const src = img(s.poster_path, "w342");
              return (
                <a key={s.id} href={titleHref(lang, s)} className="ccell">
                  <span className="ccell-img">
                    <span aria-hidden="true" style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,hsl(${hue(s.id)} 70% 50%),hsl(${(hue(s.id) + 35) % 360} 65% 24%))` }} />
                    {src && <img src={src} alt="" loading={i < 9 ? "eager" : "lazy"} decoding="async" />}
                    <span className="sc"><i style={{ background: tone(m.v) }} />{m.text}</span>
                    {p && <span className="pl" style={{ background: platformStyle(p.name).color }}>{platformStyle(p.name).short}</span>}
                  </span>
                  <b>{s.name}</b>
                  <small>{meta(s)}</small>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="clist">
            {rows.map((s) => {
              const m = metricValue(s, metric);
              const p = s.providers[0];
              return (
                <div key={s.id} className="crow">
                  <a href={titleHref(lang, s)} className="crow-main">
                    <Thumb s={s} cls="" />
                    <span><b>{s.name}</b><small>{meta(s)}{p && <span className="pl" style={{ background: platformStyle(p.name).color }}>{platformStyle(p.name).short}</span>}</small></span>
                    <b className="mono" style={{ color: tone(m.v) }}>{m.text}</b>
                  </a>
                  <span className="rbell"><FollowButton titleId={s.id} name={s.name} initial={fol.has(s.id)} variant="icon" hint={followHint(s, lang)} /></span>
                </div>
              );
            })}
          </div>
        )}
        {pages > 1 && (
          <nav className="pager" aria-label={d.catalog.pages}>
            {pg > 1 && <Link className="btn soft" href={link(pg - 1)}>{d.catalog.prev}</Link>}
            <span className="mono muted">{pg} / {pages}</span>
            {pg < pages && <Link className="btn soft" href={link(pg + 1)}>{d.catalog.next}</Link>}
          </nav>
        )}
      </div>
    </div>
  );
}
