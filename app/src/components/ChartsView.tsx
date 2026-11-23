import Link from "next/link";
import { CHART_TYPES, chartRows, chartTitle, typeTitle, type ChartSel, type ChartType } from "@/lib/charts";
import { deviceId } from "@/lib/device";
import { followedIds, genreMap, providerList, type Ctx } from "@/lib/queries";
import { dict, fmt } from "@/lib/i18n";
import { img } from "@/lib/format";
import { platformStyle } from "@/lib/platforms";
import { href, type Lang } from "@/lib/locales";
import RankList from "./RankList";
import { Calendar, Exit, Film, Flame, Sparkle, Star, Tv } from "./icons";

const ICONS: Record<ChartType, React.ReactNode> = {
  best: <Star />, trending: <Flame />, "best-tv": <Tv />, "best-movies": <Film />, "this-week": <Calendar />, new: <Sparkle />, leaving: <Exit />,
};

/** Spoločné zobrazenie rebríčkov: výber typu, filter platforiem a samotný rebríček. */
export default async function ChartsView({ lang, ctx, sel, plats }: { lang: Lang; ctx: Ctx; sel: ChartSel; plats: number[] }) {
  const d = dict(lang);
  const provs = (await providerList(ctx.region, 3)).slice(0, 14);
  // Platforma z adresy (napr. /charts/new-netflix) je vždy vybraná.
  const selected = sel.provider ? [...new Set([sel.provider.id, ...plats])] : plats;
  const [rows, fol, genres] = await Promise.all([chartRows(ctx, sel.type, selected), followedIds(await deviceId()), genreMap(lang)]);
  const pq = (ids: number[]) => (ids.length ? `?p=${ids.join(".")}` : "");
  const typeHref = (t: ChartType) => href(lang, `/charts/${t === "best" ? "" : t}`).replace(/\/$/, "") + pq(selected);
  const toggle = (id: number) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    return href(lang, `/charts/${sel.type}`) + pq(next);
  };
  const names = provs.filter((p) => selected.includes(p.id)).map((p) => p.name);
  const title = sel.provider && selected.length === 1 ? chartTitle(sel, d) : typeTitle(sel.type, d);

  return (
    <div className="charts">
      <header className="chead">
        <span className="lbl">{d.charts.title}</span>
        <h1>{title}</h1>
        <p className="muted">{names.length ? fmt(d.charts.subtitleOn, { p: names.join(", ") }) : d.charts.intro}</p>
      </header>

      <nav className="ctypes" aria-label={d.charts.choose}>
        {CHART_TYPES.map((t) => (
          <Link key={t} href={typeHref(t)} className={`ctype${t === sel.type ? " on" : ""}`} aria-current={t === sel.type ? "page" : undefined} scroll={false}>
            <span className="ci">{ICONS[t]}</span>{typeTitle(t, d)}
          </Link>
        ))}
      </nav>

      <nav className="cplats" aria-label={d.catalog.platforms}>
        <Link href={href(lang, `/charts/${sel.type}`)} className={`pchip${selected.length === 0 ? " on" : ""}`} scroll={false}>{d.charts.platformsAll}</Link>
        {provs.map((p) => {
          const on = selected.includes(p.id);
          return (
            <Link key={p.id} href={toggle(p.id)} className={`pchip${on ? " on" : ""}`} aria-pressed={on} scroll={false}>
              {p.logo_path ? <img src={img(p.logo_path, "w92")!} alt="" /> : <span className="pdot" style={{ background: platformStyle(p.name).color }} />}
              {p.name}
            </Link>
          );
        })}
      </nav>

      <section className="tile cbody">
        {rows.length ? <RankList rows={rows} lang={lang} type={sel.type} followed={fol} genres={genres} /> : <p className="empty">{d.charts.empty}</p>}
      </section>
    </div>
  );
}
