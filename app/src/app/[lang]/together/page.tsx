import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { deviceId } from "@/lib/device";
import { followedIds } from "@/lib/queries";
import { togetherMatches } from "@/lib/features";
import { page, type LangParams } from "@/lib/page";
import Poster from "@/components/Poster";
import TogetherBox from "@/components/TogetherBox";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { d } = await page(params);
  return { title: d.together.title, robots: { index: false } };
}

export default async function Together({ params, searchParams }: { params: LangParams; searchParams: Promise<{ code?: string }> }) {
  const { lang, d, ctx } = await page(params);
  const code = ((await searchParams).code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const dev = await deviceId();
  let pair: { a: string; b: string } | null = null;
  let invalid = false;
  if (code && dev) {
    // Kamarát otvoril odkaz: spojíme zariadenia (ak ešte nie sú). Odkaz potom funguje pre oboch.
    await sql`INSERT INTO devices (id) VALUES (${dev}) ON CONFLICT DO NOTHING`;
    const [r] = await sql<{ device_a: string; device_b: string | null }[]>`
      UPDATE pair_codes SET device_b = COALESCE(device_b, CASE WHEN device_a <> ${dev} THEN ${dev}::uuid END)
      WHERE code = ${code} AND expires_at > now() RETURNING device_a, device_b`;
    if (!r) invalid = true;
    else if (r.device_b && (dev === r.device_a || dev === r.device_b)) pair = { a: r.device_a, b: r.device_b };
  }
  const [matches, fol] = await Promise.all([pair ? togetherMatches(ctx, pair.a, pair.b) : Promise.resolve([]), followedIds(dev)]);
  const both = matches.filter((m) => m.wants >= 2), one = matches.filter((m) => m.wants === 1), rest = matches.filter((m) => !m.wants);

  return (
    <div className="bento">
      {invalid && <div className="tile w4 okbox">{d.together.invalid}</div>}
      {!pair && <TogetherBox />}
      {code && !pair && !invalid && <div className="tile w4"><p className="muted">{d.together.waiting}</p></div>}
      {pair && (
        <div className="tile w4">
          <div className="cathead"><h1>{d.together.matches}<small>{matches.length}</small></h1></div>
          {!matches.length && <p className="empty">{d.together.none}</p>}
          {[{ l: both, t: d.together.bothWant }, { l: one, t: d.together.oneWants }, { l: rest, t: d.together.matches }].map((g) => g.l.length > 0 && (
            <div key={g.t} className="grp">
              <div className="lbl"><span>{g.t}</span><span>{g.l.length}</span></div>
              <div className="posters">{g.l.map((s) => <Poster key={s.id} s={s} lang={lang} followed={fol.has(s.id)} />)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
