import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

/** Klik na odporúčaný (predaný) box: započíta sa a presmeruje na adresu inzerenta. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const bot = /bot|crawl|spider|preview/i.test(req.headers.get("user-agent") ?? "");
  const [p] = bot
    ? await sql<{ url: string }[]>`SELECT url FROM promos WHERE id = ${id}`
    : await sql<{ url: string }[]>`UPDATE promos SET clicks = clicks + 1 WHERE id = ${id} RETURNING url`;
  return NextResponse.redirect(p?.url ?? new URL("/", SITE_URL).toString(), 302);
}
