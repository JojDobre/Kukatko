import Link from "next/link";
import { chartTitle, type ChartSel } from "@/lib/charts";
import { CHART_FILTERS, chartList, movement, snapshotKey, type Period } from "@/lib/chartdata";
import { genreList, providerList, type Ctx } from "@/lib/queries";
import { dict, fmt } from "@/lib/i18n";
import { daysUntil, epCode, fmtDate, img, rel, tone } from "@/lib/format";
import { platformStyle } from "@/lib/platforms";
import { href, type Lang } from "@/lib/locales";
import { titleHref } from "@/lib/page";
import { Thumb } from "../Poster";
import ChartBar, { type ChartState } from "./ChartBar";
import ShareButton from "./ShareButton";

export type ChartParams = { k?: string; p?: string; g?: string; y?: string; n?: string };
const ids = (p?: string) => (p ?? "").split(".").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20);

/** Detail rebríčka: filtre podľa typu, pohyb v poradí, zoskupenie pri odchodoch. */
export default async function ChartDetail({ lang, ctx, sel, sp, keyPath }: { lang: Lang; ctx: Ctx; sel: ChartSel; sp: ChartParams; keyPath: string }) {
  const d = dict(lang);
  const c = d.charts;
  const flags = CHART_FILTERS[sel.type];
  const kind: "tv" | "movie" | null = flags.kind && (sp.k === "tv" || sp.k === "movie") ? sp.k : null;
  const locked = sel.provider?.id ?? null;
  const providers = [...new Set([...(locked ? [locked] : []), ...ids(sp.p)])];
  const genre = /^[\d.]+$/.test(sp.g ?? "") ? sp.g! : null;
  const period: string = flags.period && (["year", "5y", "2010", "2000", "1990", "1980"].includes(sp.y ?? "")) ? sp.y! : "all";
  const size = flags.size && [10, 50].includes(Number(sp.n)) ? Number(sp.n) : 100;
  const opts = { kind, providers, genre: genre ? ids(genre) : [], period: (/^\d+$/.test(period) ? Number(period) : period) as Period, limit: size };
  const gKind = sel.type === "best-tv" || sel.type === "this-week" ? "tv" : sel.type === "best-movies" ? "movie" : kind ?? "all";
  const [rows, provs, genres] = await Promise.all([chartList(ctx, sel.type, opts), providerList(ctx.region, 3), genreList(ctx, gKind)]);
  const moves = await movement(ctx.region, snapshotKey(sel.type, opts), rows.map((r) => r.id));
  const state: ChartState = { kind, providers, genre, period, size };
  const sub = { best: c.subBest, "best-tv": c.subBest, "best-movies": c.subBest, trending: c.subTrend, "this-week": c.subWeek, new: c.subNew, leaving: c.subLeaving }[sel.type];
  const title = chartTitle(sel, d);
  const ranked = ["best", "best-tv", "best-movies", "trending"].includes(sel.type);

  const meta = (r: (typeof rows)[number]) => {
    const p = r.providers[0];
    const badge = p ? <span className="pl" style={{ background: platformStyle(p.name).color }}>{platformStyle(p.name).short}</span> : null;
    if (sel.type === "trending" && r.growth != null && r.growth > 0) return <><b className="up">{fmt(c.interest, { p: `+${r.growth} %` })}</b>{badge}</>;
    if (sel.type === "this-week" && r.next_ep) return <>{epCode(r.next_ep.season, r.next_ep.episode)}{badge}</>;
    if (sel.type === "new" && r.added) return <>{fmtDate(r.added.toISOString().slice(0, 10), lang, { day: "numeric", month: "numeric" })}{badge}</>;
    if (sel.type === "leaving") return <>{r.removed_provider}</>;
    return <>{[r.kind === "tv" ? d.common.tv : d.common.movie, r.year].filter(Boolean).join(" · ")}{badge}</>;
  };
  const right = (r: (typeof rows)[number]) => {
    if (sel.type === "this-week") { const n = daysUntil(r.next_air_date); return <span className={`chipday${n != null && n <= 1 ? " hot" : ""}`}>{rel(n, lang)}</span>; }
    return <b className="mono" style={{ color: tone(r.score) }}>{r.score != null ? `${r.score}%` : "–"}</b>;
  };
  const mv = (id: number) => {
    const m = moves?.get(id);
    if (m == null) return null;
    if (m === "new") return <span className="mv new">{c.newBadge}</span>;
    if (m === 0) return <span className="mv">–</span>;
    return <span className={`mv ${m > 0 ? "up" : "down"}`}>{m > 0 ? "▲" : "▼"}{Math.abs(m)}</span>;
  };
  const item = (r: (typeof rows)[number], i: number) => (
    <Link key={r.id} href={titleHref(lang, r)} className="rk">
      {ranked && <span className="rk-n"><b className={`mono${i < 3 ? " top" : ""}`}>{i + 1}</b>{mv(r.id)}</span>}
      <Thumb s={r} cls="rk-img" />
      <span className="rk-t"><b>{r.name}</b><small>{meta(r)}</small></span>
      {right(r)}
    </Link>
  );

  // Odchody: zoskupené podľa toho, kedy titul zmizol.
  let body: React.ReactNode;
  if (sel.type === "leaving") {
    const ago = (r: (typeof rows)[number]) => r.removed ? Math.floor((Date.now() - r.removed.getTime()) / 86400_000) : 99;
    const groups = [[c.today, rows.filter((r) => ago(r) < 1)], [c.thisWeekGroup, rows.filter((r) => ago(r) >= 1 && ago(r) < 7)], [c.earlier, rows.filter((r) => ago(r) >= 7)]] as const;
    body = groups.filter(([, l]) => l.length).map(([t, l]) => <div key={t} className="rk-group"><h3>{t}</h3>{l.map((r, i) => item(r, i))}</div>);
  } else body = rows.map(item);

  return (
    <div className="bento">
      <section className="tile w4 chdet">
        <Link href={href(lang, "/charts")} className="chback">‹ {c.back}</Link>
        <div className="chtitle"><span><h1>{title}</h1><small className="muted">{sub}{moves ? ` ${c.moveNote}` : ""}</small></span><ShareButton title={title} /></div>
        <ChartBar base={href(lang, `/charts/${keyPath}`)} state={state} flags={flags} locked={locked}
          provs={provs.slice(0, 12).map((p) => { const st = platformStyle(p.name); return { id: p.id, name: p.name, logo: img(p.logo_path, "w92"), color: st.color, short: st.short }; })}
          genres={genres.map((g) => ({ ids: g.ids, name: g.name }))} />
        {rows.length ? <div className="rk-list">{body}</div> : <p className="empty">{c.empty}</p>}
      </section>
    </div>
  );
}
