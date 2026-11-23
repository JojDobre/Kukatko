import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ChartsView from "@/components/ChartsView";
import { chartTitle, parseChartKey } from "@/lib/charts";
import { page } from "@/lib/page";
import { alternates } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; key: string }>; searchParams: Promise<{ p?: string }> };
const ids = (p?: string) => (p ?? "").split(".").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20);

async function load(params: P["params"]) {
  const base = await page(params);
  const sel = await parseChartKey(base.ctx, (await params).key);
  if (!sel) notFound();
  return { ...base, sel, key: (await params).key };
}

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { lang, d, sel, key } = await load(params);
  const title = chartTitle(sel, d);
  return {
    title, description: `${title}. ${d.charts.intro} ${SITE}.`,
    alternates: alternates(lang, () => `/charts/${key}`),
    robots: (await searchParams).p ? { index: false, follow: true } : undefined,
  };
}

export default async function Chart({ params, searchParams }: P) {
  const { lang, ctx, sel } = await load(params);
  return <ChartsView lang={lang} ctx={ctx} sel={sel} plats={ids((await searchParams).p)} />;
}
