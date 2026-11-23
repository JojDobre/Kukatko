import type { Metadata } from "next";
import ChartsView from "@/components/ChartsView";
import { page, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";

export const dynamic = "force-dynamic";
type SP = Promise<{ p?: string }>;
const ids = (p?: string) => (p ?? "").split(".").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20);

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { lang, d } = await page(params);
  return { title: d.charts.title, description: d.charts.metaDesc, alternates: alternates(lang, () => "/charts") };
}

export default async function Charts({ params, searchParams }: { params: LangParams; searchParams: SP }) {
  const { lang, ctx } = await page(params);
  return <ChartsView lang={lang} ctx={ctx} sel={{ type: "best", provider: null }} plats={ids((await searchParams).p)} />;
}
