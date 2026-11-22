import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { handler } from "@/lib/api";
import { needsModeration } from "@/lib/extra";
import { DEFAULT_LANG, isLang } from "@/lib/locales";

const err = (code: string) => new Response(JSON.stringify({ error: code }), { status: 400, headers: { "Content-Type": "application/json" } });

export const POST = handler(async (dev, b) => {
  const titleId = Number(b?.titleId);
  const body = String(b?.body ?? "").replace(/\s+\n/g, "\n").trim().slice(0, 2000);
  const nickname = String(b?.nickname ?? "").replace(/[<>]/g, "").trim().slice(0, 30) || null;
  if (!Number.isInteger(titleId)) throw err("title");
  if (body.length < 20) throw err("short");
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM reviews WHERE device_id = ${dev} AND created_at > now() - interval '1 day'`;
  if (n >= 5) throw err("limit");
  const l = (await cookies()).get("lang")?.value;
  const status = needsModeration(`${nickname ?? ""} ${body}`) ? "pending" : "visible";
  const r = await sql`INSERT INTO reviews (device_id, title_id, lang, nickname, body, status)
    SELECT ${dev}, id, ${isLang(l) ? l : DEFAULT_LANG}, ${nickname}, ${body}, ${status} FROM titles WHERE id = ${titleId}
    ON CONFLICT (device_id, title_id) DO UPDATE SET body = EXCLUDED.body, nickname = EXCLUDED.nickname, status = EXCLUDED.status, reports = 0, created_at = now()
    RETURNING id`;
  if (!r.length) throw err("title");
  return NextResponse.json({ ok: true, status });
});

export const DELETE = handler(async (dev, b) => {
  await sql`DELETE FROM reviews WHERE device_id = ${dev} AND title_id = ${Number(b?.titleId)}`;
  return { ok: true };
});
