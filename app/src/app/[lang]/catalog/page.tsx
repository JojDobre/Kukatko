import type { Metadata } from "next";
import Link from "next/link";
import { deviceId } from "@/lib/device";
import { selectedPlats } from "@/lib/prefs";
import { catalog, followedIds, genreList, isKind, isSort, languageList, PAGE_SIZE, providerList, SORTS, type KindOpt } from "@/lib/queries";
import { page, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";
import Poster, { type Metric } from "@/components/Poster";
import Filters, { type FilterState } from "@/components/Filters";

export const dynamic = "force-dynamic";
type SP = Promise<{ kind?: string; sort?: string; genre?: string; page?: string; year?: string; runtime?: string; score?: string; lang?: string }>;

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
  const plats = await selectedPlats(ctx.region);
  const [{ rows, total }, provs, genres, langs, fol] = await Promise.all([
    catalog(ctx, { kind, sort, providers: plats, genre: genreIds, page: pg, decade, runtime, minScore, language }),
    providerList(ctx.region),
    genreList(ctx, kind),
    languageList(ctx, kind),
    followedIds(dev),
  ]);
  const metric: Metric = (["imdb", "tmdb", "rt", "users"] as const).includes(sort as any) ? (sort as Metric) : "score";
  const pages = Math.ceil(total / PAGE_SIZE);
  const state: FilterState = { kind, sort, genre: genreIds.length ? genreIds.join(".") : null, year: decade, runtime, score: minScore, lang: language };
  const link = (p: number) => {
    const q = new URLSearchParams();
    if (kind !== "all") q.set("kind", kind);
    if (sort !== "score") q.set("sort", sort);
    if (genreIds.length) q.set("genre", genreIds.join("."));
    if (decade) q.set("year", String(decade));
    if (runtime) q.set("runtime", runtime);
    if (minScore) q.set("score", String(minScore));
    if (language) q.set("lang", language);
    if (p > 1) q.set("page", String(p));
    return h(`/catalog${q.size ? "?" + q : ""}`);
  };

  return (
    <div className="bento">
      <div className="tile w4">
        <div className="cathead">
          <h1>{d.catalog.title}<small>{total}</small></h1>
        </div>
        <Filters state={state} sorts={Object.keys(SORTS)} providers={provs} selected={plats} region={ctx.region} genres={genres} languages={langs} />
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
