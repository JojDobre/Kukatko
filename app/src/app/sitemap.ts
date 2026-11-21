import type { MetadataRoute } from "next";
import { sitemapRows } from "@/lib/queries";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await sitemapRows().catch(() => []);
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/katalog`, changeFrequency: "daily", priority: 0.9 },
    ...rows.map((r) => ({ url: `${SITE_URL}/serial/${r.id}-${r.slug}`, lastModified: r.synced_at, changeFrequency: "daily" as const, priority: 0.7 })),
  ];
}
