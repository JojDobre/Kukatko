import type { Metadata } from "next";
import { page } from "@/lib/page";
import TitlePage, { loadTitle, titleMetadata } from "@/components/TitlePage";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await page(params);
  return titleMetadata(await loadTitle("movie", (await params).slug), lang);
}

export default async function Page({ params }: P) {
  const { lang } = await page(params);
  const { slug } = await params;
  return <TitlePage t={await loadTitle("movie", slug)} lang={lang} slug={slug} />;
}
