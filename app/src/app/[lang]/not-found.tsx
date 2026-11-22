import Link from "next/link";
import { cookies } from "next/headers";
import { dict } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/locales";

export default async function NotFound() {
  const c = (await cookies()).get("lang")?.value;
  const lang = isLang(c) ? c : DEFAULT_LANG;
  const d = dict(lang).notFound;
  return (
    <div className="tile" style={{ alignItems: "flex-start" }}>
      <h1 style={{ fontSize: 28 }}>{d.title}</h1>
      <p className="muted">{d.text}</p>
      <Link className="btn" href={href(lang, "/catalog")}>{d.cta}</Link>
    </div>
  );
}
