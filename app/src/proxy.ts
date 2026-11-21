import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "kid";

/** Každé zariadenie dostane náhodné id v cookie (bez registrácie). */
export function proxy(req: NextRequest) {
  if (req.cookies.get(COOKIE)) return NextResponse.next();
  const id = crypto.randomUUID();
  // Pridáme cookie aj do aktuálnej požiadavky, aby ju stránka videla hneď pri prvej návšteve.
  const headers = new Headers(req.headers);
  headers.set("cookie", [req.headers.get("cookie"), `${COOKIE}=${id}`].filter(Boolean).join("; "));
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(COOKIE, id, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 * 2,
    secure: req.nextUrl.protocol === "https:",
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/|icons/|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|\\.well-known/|favicon).*)"],
};
