import type { MetadataRoute } from "next";
import { LANGS, href } from "@/lib/locales";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const priv = ["/watchlist", "/profile", "/search", "/transfer", "/together", "/stats"];
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/out/", "/admin", ...LANGS.flatMap((l) => priv.map((p) => href(l, p)))],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
