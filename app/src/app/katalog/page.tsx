import type { Metadata } from "next";
import Link from "next/link";
import { deviceId } from "@/lib/device";
import { selectedPlats } from "@/lib/prefs";
import { catalog, followedIds, genreList, isSort, PAGE_SIZE, providerList, SORTS } from "@/lib/queries";
import Poster, { type Metric } from "@/components/Poster";
import Filters from "@/components/Filters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Katalóg seriálov",
  description: "Všetky seriály dostupné na slovenských streamovacích službách. Zoraď podľa hodnotenia IMDb, TMDB, Rotten Tomatoes alebo podľa najbližšej epizódy.",
};

type SP = Promise<{ zoradit?: string; zaner?: string; strana?: string }>;

export default async function Katalog({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const sort = isSort(sp.zoradit) ? sp.zoradit : "score";
  const genre = sp.zaner?.slice(0, 60) || null;
  const page = Math.max(1, Math.min(500, Number(sp.strana) || 1));
  const [dev, plats] = await Promise.all([deviceId(), selectedPlats()]);
  const [{ rows, total }, provs, genres, fol] = await Promise.all([
    catalog({ sort, providers: plats, genre, page }),
    providerList(),
    genreList(),
    followedIds(dev),
  ]);
  const metric: Metric = (["imdb", "tmdb", "rt", "users"] as const).includes(sort as any) ? (sort as Metric) : "score";
  const pages = Math.ceil(total / PAGE_SIZE);
  const link = (p: number) => {
    const q = new URLSearchParams();
    if (sp.zoradit) q.set("zoradit", sp.zoradit);
    if (genre) q.set("zaner", genre);
    if (p > 1) q.set("strana", String(p));
    return `/katalog${q.size ? "?" + q : ""}`;
  };

  return (
    <div className="bento">
      <div className="tile w4 open">
        <div className="cathead">
          <h1>Katalóg<small>{total}</small></h1>
          <Filters
            sorts={Object.entries(SORTS).map(([key, v]) => ({ key, label: v.label }))}
            sort={sort}
            providers={provs}
            selected={plats}
            genres={genres}
            genre={genre}
          />
        </div>
        <div className="posters">
          {rows.length
            ? rows.map((s, i) => <Poster key={s.id} s={s} followed={fol.has(s.id)} metric={metric} priority={i < 6} />)
            : <div className="empty">Žiadny seriál nesedí na filtre. Skús zrušiť niektorý z nich.</div>}
        </div>
        {pages > 1 && (
          <nav className="pager" aria-label="Strany">
            {page > 1 && <Link className="btn soft" href={link(page - 1)}>Predchádzajúca</Link>}
            <span className="mono muted">{page} / {pages}</span>
            {page < pages && <Link className="btn soft" href={link(page + 1)}>Ďalšia</Link>}
          </nav>
        )}
      </div>
    </div>
  );
}
