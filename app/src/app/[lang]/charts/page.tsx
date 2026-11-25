import type { Metadata } from "next";
import ChartsHome from "@/components/charts/ChartsHome";
import { page, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { lang, d } = await page(params);
  return { title: d.charts.title, description: d.charts.metaDesc, alternates: alternates(lang, () => "/charts") };
}

export default async function Charts({ params }: { params: LangParams }) {
  const { lang, ctx } = await page(params);
  return <ChartsHome lang={lang} ctx={ctx} />;
}
