import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { SITE_URL } from "@/lib/site";

/** Pridanie, zapnutie/vypnutie a zmazanie odporúčaného boxu z administrácie. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return new Response("Forbidden", { status: 403 });
  const f = await req.formData();
  const action = String(f.get("action"));
  const str = (k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max) || null;
  if (action === "create") {
    const url = str("url", 1000);
    const headline = str("headline", 120);
    if (url && /^https?:\/\//.test(url) && headline) {
      const tmdb = Number(str("tmdb"));
      const kind = str("kind") === "movie" ? "movie" : "tv";
      await sql`INSERT INTO promos (label, title_id, headline, body, image_url, url, langs, starts_at, ends_at)
        VALUES (${str("label", 80) ?? headline}, (SELECT id FROM titles WHERE kind = ${kind} AND tmdb_id = ${tmdb || 0}),
          ${headline}, ${str("body", 240)}, ${str("image", 1000)}, ${url},
          ${(str("langs") ?? "").split(",").map((x) => x.trim()).filter(Boolean)},
          ${str("starts") ?? new Date().toISOString().slice(0, 10)}, ${str("ends") ?? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)})`;
    }
  }
  const id = Number(f.get("id"));
  if (action === "toggle") await sql`UPDATE promos SET active = NOT active WHERE id = ${id}`;
  if (action === "delete") await sql`DELETE FROM promos WHERE id = ${id}`;
  return NextResponse.redirect(new URL("/admin#promos", SITE_URL), 303);
}
