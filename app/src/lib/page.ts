import { notFound } from "next/navigation";
import { dict } from "./i18n";
import { href, isLang, type Lang } from "./locales";
import { userRegion } from "./prefs";
import type { Ctx } from "./queries";
import type { Kind } from "./tmdb";

export type LangParams = Promise<{ lang: string }>;

/** Spoločné veci pre stránku v danom jazyku. Neznámy jazyk = 404. */
export async function page(params: Promise<{ lang: string }>) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const ctx: Ctx = { lang, region: await userRegion(lang) };
  return { lang, d: dict(lang), ctx, h: (p: string) => href(lang, p) };
}

export const titleHref = (lang: Lang, t: { kind: Kind; tmdb_id: number; slug: string }) => href(lang, `/${t.kind}/${t.tmdb_id}-${t.slug}`);
export const personHref = (lang: Lang, p: { id: number; slug?: string | null; name?: string }) =>
  href(lang, `/person/${p.id}${p.slug ? `-${p.slug}` : ""}`);
