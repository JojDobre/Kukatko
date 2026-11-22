import type { Metadata } from "next";
import { LANGS, href, type Lang } from "./locales";

/** Kanonická adresa a jazykové verzie (hreflang) pre stránku. */
export function alternates(lang: Lang, pathFor: (l: Lang) => string): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of LANGS) languages[l] = href(l, pathFor(l));
  languages["x-default"] = href(LANGS[0], pathFor(LANGS[0]));
  return { canonical: href(lang, pathFor(lang)), languages };
}
