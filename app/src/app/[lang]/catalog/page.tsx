import type { Metadata } from "next";
import Link from "next/link";
import { deviceId } from "@/lib/device";
import { selectedPlats } from "@/lib/prefs";
import { catalog, followedIds, genreList, isKind, isSort, languageList, PAGE_SIZE, providerList, SORTS } from "@/lib/queries";
import { page, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";
import Poster, { type Metric } from "@/components/Poster";
import Filters from "@/components/Filters";

export const dynamic = "force-dynamic";
type SP = Promise<{ kind?: string; sort?: string; genre?: string; page?: string; year?: string; runtime?: string; score?: string; lang?: string }>;

export async function generateMetadata({ params, searchParams }: { params: LangParams; searchParams: SP }): Promise<Metadata> {
  const { lang, d } = await page(params);
  const sp = await searchParams;
  const movie = sp.kind === "movie";
  return {
    title: movie ? `${d.common.movies}: ${d.catalog.title}` : d.catalog.metaTitle,
    description: d.catalog.metaDesc,
    alternates: alternates(lang, () => `/catalog${movie ? "?kind=movie" : ""}`),
    robots: sp.genre || sp.sort || sp.page || sp.year || sp.runtime || sp.score || sp.lang ? { index: false, follow: true } : undefined,
  };
}

export default async function Catalog({ params, searchParams }: { params: LangParams; searchParams: SP }) {
  const { lang, d, ctx, h } = await page(params);
  const sp = await searchParams;
  const kind = isKind(sp.kind) ? sp.kind : "tv";
  const sort = isSort(sp.sort) && !(kind === "movie" && sp.sort === "next") ? sp.sort : "score";
  const genre = Number(sp.genre) || null;
  const pg = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const decade = [2020, 2010, 2000, 1990, 1980, 1970].includes(Number(sp.year)) ? Number(sp.year) : null;
  const runtime = sp.runtime === "short" || sp.runtime === "medium" || sp.runtime === "long" ? sp.runtime : null;
  const minScore = [60, 70, 80, 90].includes(Number(sp.score)) ? Number(sp.score) : null;
  const language = /^[a-z]{2}$/.test(sp.lang ?? "") ? sp.lang! : null;
  const dev = await deviceId();
  const plats = await selectedPlats(ctx.region);
  const [{ rows, total }, provs, genres, langs, fol] = await Promise.all([
    catalog(ctx, { kind, sort, providers: plats, genre, page: pg, decade, runtime, minScore, language }),
    providerList(ctx.region),
    genreList(ctx, kind),
    languageList(ctx, kind),
    followedIds(dev),
  ]);
  const metric: Metric = (["imdb", "tmdb", "rt", "users"] as const).includes(sort as any) ? (sort as Metric) : "score";
  const pages = Math.ceil(total / PAGE_SIZE);
  const link = (p: number) => {
    const q = new URLSearchParams();
    if (kind === "movie") q.set("kind", "movie");
    if (sort !== "score") q.set("sort", sort);
    if (genre) q.set("genre", String(genre));
    if (decade) q.set("year", String(decade));
    if (runtime) q.set("runtime", runtime);
    if (minScore) q.set("score", String(minScore));
    if (language) q.set("lang", language);
    if (p > 1) q.set("page", String(p));
    return h(`/catalog${q.size ? "?" + q : ""}`);
  };
  const sorts = Object.keys(SORTS).filter((k) => !(kind === "movie" && k === "next"));

  return (
    <div className="bento">
      <div className="tile w4 open">
        <div className="cathead">
          <h1>{kind === "movie" ? d.common.movies : d.common.tvs}<small>{total}</small></h1>
          <Filters kind={kind} sort={sort} sorts={sorts} providers={provs} selected={plats} region={ctx.region} genres={genres} genre={genre}
            languages={langs} extra={{ decade, runtime, language, minScore }} />
        </div>
        <div className="posters">
          {rows.length
            ? rows.map((s, i) => <Poster key={s.id} s={s} lang={lang} followed={fol.has(s.id)} metric={metric} priority={i < 6} />)
            : <div className="empty">{d.catalog.empty}</div>}
        </div>
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
