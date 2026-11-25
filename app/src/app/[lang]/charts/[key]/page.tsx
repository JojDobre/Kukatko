import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ChartDetail, { type ChartParams } from "@/components/charts/ChartDetail";
import { chartTitle, parseChartKey } from "@/lib/charts";
import { page } from "@/lib/page";
import { alternates } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; key: string }>; searchParams: Promise<ChartParams> };

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
    robots: Object.keys(await searchParams).length ? { index: false, follow: true } : undefined,
  };
}

export default async function Chart({ params, searchParams }: P) {
  const { lang, ctx, sel, key } = await load(params);
  return <ChartDetail lang={lang} ctx={ctx} sel={sel} sp={await searchParams} keyPath={key} />;
}
