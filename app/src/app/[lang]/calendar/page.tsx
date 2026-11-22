import type { Metadata } from "next";
import Link from "next/link";
import { deviceId } from "@/lib/device";
import { selectedPlats } from "@/lib/prefs";
import { calendar, type CalItem } from "@/lib/features";
import { epCode, fmtDate, todayISO } from "@/lib/format";
import { platformStyle } from "@/lib/platforms";
import { ALL_LOCALES } from "@/lib/locales";
import { page, titleHref, type LangParams } from "@/lib/page";
import { alternates } from "@/lib/seo";
import { Thumb } from "@/components/Poster";

export const dynamic = "force-dynamic";
type SP = Promise<{ month?: string; mine?: string }>;

function monthRange(m: string | undefined) {
  const today = todayISO();
  const ok = /^\d{4}-(0[1-9]|1[0-2])$/.test(m ?? "") ? m! : today.slice(0, 7);
  const [y, mo] = ok.split("-").map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const shift = (n: number) => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  return { month: ok, from: `${ok}-01`, to: `${ok}-${String(last).padStart(2, "0")}`, prev: shift(-1), next: shift(1), today };
}

export async function generateMetadata({ params }: { params: LangParams }): Promise<Metadata> {
  const { lang, d } = await page(params);
  return { title: d.calendar.title, description: d.calendar.metaDesc, alternates: alternates(lang, () => "/calendar") };
}

export default async function CalendarPage({ params, searchParams }: { params: LangParams; searchParams: SP }) {
  const { lang, d, ctx, h } = await page(params);
  const sp = await searchParams;
  const r = monthRange(sp.month);
  const mine = sp.mine === "1";
  const dev = await deviceId();
  const plats = await selectedPlats(ctx.region);
  const items = await calendar(ctx, r.from, r.to, dev, plats, mine);
  const days = new Map<string, CalItem[]>();
  for (const it of items) days.set(it.date, [...(days.get(it.date) ?? []), it]);
  const monthName = new Date(r.from + "T12:00:00Z").toLocaleDateString(ALL_LOCALES[lang].intl, { month: "long", year: "numeric", timeZone: "UTC" });
  const q = (m: string, mn = mine) => h(`/calendar?month=${m}${mn ? "&mine=1" : ""}`);

  return (
    <div className="bento">
      <div className="tile w4 open">
        <div className="cathead">
          <h1>{d.calendar.title}<small>{monthName}</small></h1>
          <div className="filters">
            <Link className="ddb" href={q(r.prev)} aria-label={d.calendar.prev}>‹</Link>
            <Link className="ddb" href={q(r.next)} aria-label={d.calendar.next}>›</Link>
            <div className="seg" role="group">
              <Link className="segl" aria-current={!mine ? "true" : undefined} href={q(r.month, false)}>{d.calendar.all}</Link>
              <Link className="segl" aria-current={mine ? "true" : undefined} href={q(r.month, true)}>{d.calendar.onlyMine}</Link>
            </div>
          </div>
        </div>
        {days.size === 0 && <p className="empty">{d.calendar.empty}</p>}
        <div className="cal">
          {[...days].map(([date, list]) => (
            <section key={date} className={`calday${date === r.today ? " today" : ""}${date < r.today ? " past" : ""}`}>
              <h2 className="mono">{fmtDate(date, lang, { weekday: "long", day: "numeric", month: "numeric" })}</h2>
              {list.map((it) => (
                <Link key={`${it.title_id}-${it.season}-${it.episode}`} href={titleHref(lang, it)} className={`wrow${it.followed ? " fol" : ""}`}>
                  <Thumb s={{ id: it.title_id, poster_path: it.poster_path }} />
                  <span>
                    <b>{it.name}</b>
                    <small>{epCode(it.season, it.episode)}{it.ep_name ? ` · ${it.ep_name}` : ""}</small>
                  </span>
                  <span className="pm">
                    {it.episode === 1 && <span className="chipday hot">{d.calendar.premiere}</span>}
                    {it.providers.slice(0, 2).map((p) => { const st = platformStyle(p.name); return <span key={p.id} className="pl" style={{ background: st.color }}>{st.short}</span>; })}
                  </span>
                </Link>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
