import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LANG, LANGS, isLang } from "./lib/locales";

const KID = "kid";
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview/i;

/** Z hlavičky Accept-Language vyberie prvý zapnutý jazyk. */
function preferred(header: string | null) {
  if (!header) return null;
  for (const part of header.split(",")) {
    const code = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return null;
}

/**
 * 1) Každé zariadenie dostane náhodné id v cookie (bez registrácie).
 * 2) Jazyk: predvolený jazyk nemá v adrese predponu (/katalog), ostatné áno (/cs/catalog).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // Po vnútornom prepísaní (/catalog → /sk/catalog) už nič nemeníme.
  if (req.headers.get("x-kuk-rw") === "1") return NextResponse.next();
  const headers = new Headers(req.headers);
  let newKid: string | null = null;
  if (!req.cookies.get(KID)) {
    newKid = crypto.randomUUID();
    headers.set("cookie", [req.headers.get("cookie"), `${KID}=${newKid}`].filter(Boolean).join("; "));
  }

  const finish = (res: NextResponse, lang?: string) => {
    if (newKid) res.cookies.set(KID, newKid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 * 2, secure: req.nextUrl.protocol === "https:" });
    // Android appka otvára úvodnú stránku s ?zdroj=app. Zapamätáme si to (kvôli pravidlám Google Play).
    if (req.nextUrl.searchParams.get("zdroj") === "app" || req.headers.get("referer")?.startsWith("android-app://")) {
      res.cookies.set("app", "1", { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 * 2 });
    }
    if (lang && req.cookies.get("lang")?.value !== lang) res.cookies.set("lang", lang, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  };

  if (pathname.startsWith("/api/") || pathname.startsWith("/out/") || pathname.startsWith("/admin")) {
    return finish(NextResponse.next({ request: { headers } }));
  }

  const first = pathname.split("/")[1];
  if (isLang(first)) {
    if (first === DEFAULT_LANG) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.slice(first.length + 1) || "/";
      return finish(NextResponse.redirect(url, 308));
    }
    return finish(NextResponse.next({ request: { headers } }), first);
  }

  // Prvá návšteva úvodnej stránky: ponúkneme jazyk podľa prehliadača.
  if (pathname === "/" && !req.cookies.get("lang") && !BOT.test(req.headers.get("user-agent") ?? "")) {
    const want = preferred(req.headers.get("accept-language"));
    if (want && want !== DEFAULT_LANG && LANGS.length > 1) {
      return finish(NextResponse.redirect(new URL(`/${want}${search}`, req.url), 307), want);
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${DEFAULT_LANG}${pathname === "/" ? "" : pathname}`;
  headers.set("x-kuk-rw", "1");
  return finish(NextResponse.rewrite(url, { request: { headers } }), DEFAULT_LANG);
}

export const config = {
  matcher: ["/((?!_next/|icons/|sw.js|offline.html|manifest.webmanifest|robots.txt|sitemap|\\.well-known/|favicon|icon.png).*)"],
};
