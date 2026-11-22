import { NextResponse } from "next/server";
import { adminSig } from "@/lib/admin";
import { SITE_URL } from "@/lib/site";

export async function POST(req: Request) {
  const f = await req.formData();
  const token = process.env.ADMIN_TOKEN;
  const res = NextResponse.redirect(new URL("/admin", SITE_URL), 303);
  if (token && token.length >= 12 && f.get("token") === token) {
    res.cookies.set("adm", adminSig(token), { httpOnly: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 30, secure: SITE_URL.startsWith("https") });
  } else {
    await new Promise((r) => setTimeout(r, 1500)); // spomalenie hádania hesla
  }
  return res;
}
