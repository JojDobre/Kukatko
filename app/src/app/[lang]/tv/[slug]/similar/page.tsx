import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { page } from "@/lib/page";
import { texts } from "@/lib/queries";
import { loadTitle } from "@/components/TitlePage";
import SimilarPage, { similarMetadata } from "@/components/SimilarPage";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await page(params);
  return similarMetadata(await loadTitle("tv", (await params).slug), lang);
}

export default async function Page({ params }: P) {
  const { lang, h } = await page(params);
  const { slug } = await params;
  const t = await loadTitle("tv", slug);
  const good = `${t.tmdb_id}-${texts(t, lang).slug}`;
  if (slug !== good) permanentRedirect(h(`/tv/${good}/similar`));
  return <SimilarPage t={t} lang={lang} />;
}
