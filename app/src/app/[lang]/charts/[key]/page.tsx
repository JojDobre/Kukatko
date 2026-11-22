import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deviceId } from "@/lib/device";
import { chartList, chartRows } from "@/lib/charts";
import { followedIds } from "@/lib/queries";
import { fmt } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import { page } from "@/lib/page";
import { alternates } from "@/lib/seo";
import { SITE } from "@/lib/site";
import Poster from "@/components/Poster";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; key: string }> };

async function load(params: P["params"]) {
  const base = await page(params);
  const { key } = await params;
  const def = (await chartList(base.ctx, base.d)).find((c) => c.key === key);
  if (!def) notFound();
  return { ...base, def };
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang, d, def } = await load(params);
  return {
    title: def.title,
    description: `${def.title}. ${d.charts.intro} ${SITE}.`,
    alternates: alternates(lang, () => `/charts/${def.key}`),
  };
}

export default async function Chart({ params }: P) {
  const { lang, d, ctx, h, def } = await load(params);
  const dev = await deviceId();
  const [rows, fol] = await Promise.all([chartRows(ctx, def), followedIds(dev)]);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const metric = def.key.startsWith("best") ? "score" : "score";
  return (
    <div className="bento">
      <div className="tile w4">
        <div className="cathead">
          <h1>{def.title}<small>{rows.length}</small></h1>
          <Link className="btn soft" href={h("/charts")}>{d.charts.title}</Link>
        </div>
        <ItemList json={rows.map((r, i) => ({ pos: i + 1, name: r.name }))} />
        <div className="posters">
          {rows.length ? rows.map((s, i) => (
            <Poster key={s.id} s={s} lang={lang} followed={fol.has(s.id)} metric={metric} priority={i < 6}
              note={s.removed ? <span>{fmt(d.charts.removed, { p: s.removed_provider ?? "", date: fmtDate(iso(s.removed), lang, { day: "numeric", month: "numeric" }) })}</span>
                : s.added ? <span className="nx">{fmt(d.charts.added, { date: fmtDate(iso(s.added), lang, { day: "numeric", month: "numeric" }) })}</span> : undefined} />
          )) : <div className="empty">{d.charts.empty}</div>}
        </div>
      </div>
    </div>
  );
}

function ItemList({ json }: { json: { pos: number; name: string }[] }) {
  if (!json.length) return null;
  const ld = { "@context": "https://schema.org", "@type": "ItemList", itemListElement: json.slice(0, 30).map((x) => ({ "@type": "ListItem", position: x.pos, name: x.name })) };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />;
}
