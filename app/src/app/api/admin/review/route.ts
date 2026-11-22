import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { SITE_URL } from "@/lib/site";

/** Schválenie, skrytie alebo zmazanie recenzie z administrácie. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return new Response("Forbidden", { status: 403 });
  const f = await req.formData();
  const id = Number(f.get("id"));
  const action = String(f.get("action"));
  if (action === "approve") await sql`UPDATE reviews SET status = 'visible', reports = 0 WHERE id = ${id}`;
  if (action === "hide") await sql`UPDATE reviews SET status = 'hidden' WHERE id = ${id}`;
  if (action === "delete") await sql`DELETE FROM reviews WHERE id = ${id}`;
  if (action === "ban") {
    // Zmaže všetky recenzie zariadenia, ktoré spamuje.
    await sql`DELETE FROM reviews WHERE device_id = (SELECT device_id FROM reviews WHERE id = ${id})`;
  }
  return NextResponse.redirect(new URL("/admin", SITE_URL), 303);
}
