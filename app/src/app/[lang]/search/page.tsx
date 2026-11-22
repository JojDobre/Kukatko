import type { Metadata } from "next";
import Link from "next/link";
import { deviceId } from "@/lib/device";
import { followedIds, search, searchPeople, topRated } from "@/lib/queries";
import { fmt } from "@/lib/i18n";
import { img } from "@/lib/format";
import { page, personHref, type LangParams } from "@/lib/page";
import Poster from "@/components/Poster";
import SearchBox from "@/components/SearchBox";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { d } = await page(params);
  return { title: d.search.title, robots: { index: false } };
}

export default async function SearchPage({ params, searchParams }: { params: LangParams; searchParams: Promise<{ q?: string }> }) {
  const { lang, d, ctx } = await page(params);
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const dev = await deviceId();
  const has = q.length >= 2;
  const [rows, people, fol] = await Promise.all([has ? search(ctx, q) : topRated(ctx, null, 18), has ? searchPeople(q) : [], followedIds(dev)]);
  return (
    <>
      <SearchBox initial={q} />
      <div className="bento">
        {people.length > 0 && (
          <div className="tile w4">
            <div className="lbl"><span>{d.search.people}</span><span>{people.length}</span></div>
            <div className="cast">
              {people.map((p) => (
                <Link key={p.id} href={personHref(lang, p)} className="person">
                  {p.profile_path ? <img className="av" src={img(p.profile_path, "w185")!} alt="" loading="lazy" />
                    : <span className="av avx">{p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>}
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="tile w4">
          <div className="lbl"><span>{has ? fmt(d.search.resultsFor, { q }) : d.home.topRated}</span><span>{rows.length}</span></div>
          <div className="posters">
            {rows.length ? rows.map((s) => <Poster key={s.id} s={s} lang={lang} followed={fol.has(s.id)} />)
              : <div className="empty">{d.search.nothing}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
