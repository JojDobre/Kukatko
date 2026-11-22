import type { Metadata } from "next";
import { deviceId } from "@/lib/device";
import { selectedPlats } from "@/lib/prefs";
import { followedIds } from "@/lib/queries";
import { MOODS, TIMES, idSet, pick } from "@/lib/features";
import { page, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";
import Poster from "@/components/Poster";
import PickWizard from "@/components/PickWizard";
import TitleActions from "@/components/TitleActions";
import Link from "next/link";

export const dynamic = "force-dynamic";
type SP = Promise<{ mood?: string; kind?: string; time?: string; seed?: string }>;

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { lang, d } = await page(params);
  return { title: d.pick.title, description: d.pick.metaDesc, alternates: alternates(lang, () => "/pick") };
}

export default async function Pick({ params, searchParams }: { params: LangParams; searchParams: SP }) {
  const { lang, d, ctx, h } = await page(params);
  const sp = await searchParams;
  const mood = sp.mood && sp.mood in MOODS ? sp.mood : undefined;
  const kind = sp.kind === "tv" || sp.kind === "movie" || sp.kind === "any" ? sp.kind : undefined;
  const time = sp.time && sp.time in TIMES ? (sp.time as keyof typeof TIMES) : undefined;
  const seed = Number(sp.seed) || 1;
  const dev = await deviceId();
  const plats = await selectedPlats(ctx.region);
  const ready = mood && kind && time;
  const [rows, fol, wants] = await Promise.all([ready ? pick(ctx, { mood, kind, time, providers: plats, deviceId: dev, seed }) : Promise.resolve([]), followedIds(dev), idSet("want", dev)]);
  const again = h(`/pick?mood=${mood}&kind=${kind}&time=${time}&seed=${(seed * 7919 + 13) % 1000003}`);

  return (
    <div className="bento">
      <div className="tile w4">
        <h1 style={{ fontSize: "clamp(28px,4vw,44px)" }}>{d.pick.title}</h1>
        <p className="muted">{plats.length ? d.pick.onPlatforms : d.pick.anyPlatform}</p>
        <PickWizard initial={{ mood, kind, time }} />
      </div>
      {ready && (
        <div className="tile w4" id="tipy">
          <div className="cathead">
            <h2>{d.pick.result}</h2>
            <div className="frow"><Link className="btn" href={again} scroll={false}>{d.pick.again}</Link><Link className="btn soft" href={h("/pick")}>{d.pick.restart}</Link></div>
          </div>
          {rows.length ? (
            <div className="picks">
              {rows.map((s, i) => (
                <div key={s.id} className="pickc">
                  <Poster s={s} lang={lang} followed={fol.has(s.id)} priority={i < 3} />
                  {s.overview && <p className="muted small clamp">{s.overview}</p>}
                  <TitleActions titleId={s.id} kind={s.kind} want={wants.has(s.id)} hidden={false} seen={false} />
                </div>
              ))}
            </div>
          ) : <p className="empty">{d.pick.none}</p>}
        </div>
      )}
    </div>
  );
}
