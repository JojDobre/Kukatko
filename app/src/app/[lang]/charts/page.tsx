import type { Metadata } from "next";
import Link from "next/link";
import { chartList } from "@/lib/charts";
import { page, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";
import { platformStyle } from "@/lib/platforms";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { lang, d } = await page(params);
  return { title: d.charts.title, description: d.charts.metaDesc, alternates: alternates(lang, () => "/charts") };
}

export default async function Charts({ params }: { params: LangParams }) {
  const { d, ctx, h } = await page(params);
  const list = await chartList(ctx, d);
  const general = list.filter((c) => c.group === "general");
  const byProv = new Map<number, typeof list>();
  for (const c of list.filter((c) => c.provider)) byProv.set(c.provider!.id, [...(byProv.get(c.provider!.id) ?? []), c]);
  return (
    <div className="bento">
      <div className="tile w4">
        <h1 style={{ fontSize: 28 }}>{d.charts.title}</h1>
        <p className="muted">{d.charts.intro}</p>
      </div>
      <div className="tile w4">
        <div className="lbl"><span>{d.charts.general}</span></div>
        <div className="chartlinks">{general.map((c) => <Link key={c.key} className="chip big" href={h(`/charts/${c.key}`)}>{c.title}</Link>)}</div>
      </div>
      {[...byProv.values()].map((cs) => {
        const p = cs[0].provider!;
        return (
          <div key={p.id} className="tile">
            <div className="lbl"><span><span className="pdot" style={{ background: platformStyle(p.name).color }} />{p.name}</span></div>
            {cs.map((c) => <Link key={c.key} className="wl" href={h(`/charts/${c.key}`)}>{c.title}<small>→</small></Link>)}
          </div>
        );
      })}
    </div>
  );
}
