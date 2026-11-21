import type { Metadata } from "next";
import { deviceId } from "@/lib/device";
import { followedIds, search, topRated } from "@/lib/queries";
import Poster from "@/components/Poster";
import SearchBox from "@/components/SearchBox";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hľadať seriál", robots: { index: false } };

export default async function Hladat({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const dev = await deviceId();
  const [rows, fol] = await Promise.all([q.length >= 2 ? search(q) : topRated(18), followedIds(dev)]);
  return (
    <>
      <SearchBox initial={q} />
      <div className="tile">
        <div className="lbl"><span>{q.length >= 2 ? `Výsledky pre „${q}“` : "Najlepšie hodnotené"}</span><span>{rows.length}</span></div>
        <div className="posters">
          {rows.length ? rows.map((s) => <Poster key={s.id} s={s} followed={fol.has(s.id)} />)
            : <div className="empty">Nič sa nenašlo. Skús iný názov alebo meno herca.</div>}
        </div>
      </div>
    </>
  );
}
