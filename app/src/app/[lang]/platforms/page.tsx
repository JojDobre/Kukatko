import type { Metadata } from "next";
import Link from "next/link";
import { providerList } from "@/lib/queries";
import { img } from "@/lib/format";
import { platformStyle } from "@/lib/platforms";
import { page, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { lang, d } = await page(params);
  return { title: d.platform.all, description: d.platform.allIntro, alternates: alternates(lang, () => "/platforms") };
}

export default async function Platforms({ params }: { params: LangParams }) {
  const { d, ctx, h } = await page(params);
  const provs = await providerList(ctx.region, 3);
  return (
    <div className="bento">
      <div className="tile w4">
        <h1 style={{ fontSize: 28 }}>{d.platform.all}</h1>
        <p className="muted">{d.platform.allIntro}</p>
      </div>
      {provs.map((p) => {
        const st = platformStyle(p.name);
        return (
          <Link key={p.id} href={h(`/platform/${p.slug}`)} className="tile click plat">
            {p.logo_path ? <img src={img(p.logo_path, "w92")!} alt="" /> : <span className="pl big" style={{ background: st.color }}>{st.short}</span>}
            <b>{p.name}</b>
            <span className="muted">{p.count} {d.platform.inCatalog}</span>
          </Link>
        );
      })}
    </div>
  );
}
