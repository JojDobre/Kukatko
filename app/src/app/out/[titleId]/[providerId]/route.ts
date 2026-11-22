import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { AFFILIATE } from "@/lib/platforms";
import { todayISO } from "@/lib/format";
import { SITE_URL } from "@/lib/site";

/** Odkaz „Kde pozerať“: započíta klik (štatistika) a presmeruje na platformu. */
export async function GET(req: Request, { params }: { params: Promise<{ titleId: string; providerId: string }> }) {
  const { titleId, providerId } = await params;
  const tid = Number(titleId), pid = Number(providerId);
  const region = (new URL(req.url).searchParams.get("r") ?? "").toUpperCase().slice(0, 2);
  const [t] = await sql<{ watch_links: Record<string, string>; providers: Record<string, { id: number; name: string }[]> }[]>`
    SELECT watch_links, providers FROM titles WHERE id = ${tid}`.catch(() => []);
  const p = t?.providers?.[region]?.find((x) => x.id === pid);
  if (!t || !p) return NextResponse.redirect(new URL("/", SITE_URL));
  const bot = /bot|crawl|spider|preview/i.test(req.headers.get("user-agent") ?? "");
  if (!bot) {
    await sql`INSERT INTO clicks (day, title_id, provider_id, region, count) VALUES (${todayISO()}, ${tid}, ${pid}, ${region}, 1)
      ON CONFLICT (day, title_id, provider_id, region) DO UPDATE SET count = clicks.count + 1`.catch(() => {});
  }
  const target = AFFILIATE[p.name] ?? t.watch_links[region] ?? "https://www.justwatch.com";
  return NextResponse.redirect(target, 302);
}
