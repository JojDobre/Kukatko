import Link from "next/link";
import { dict } from "@/lib/i18n";
import { href, type Lang } from "@/lib/locales";
import { Arrow, Calendar, Chart, Dice, Users } from "./icons";

/** Karty s ikonou: Čo dnes, Kalendár, Štatistiky, Pozerajte spolu. */
export default function QuickLinks({ lang }: { lang: Lang }) {
  const m = dict(lang).more;
  const items = [
    { to: "/pick", icon: <Dice />, title: m.pick, sub: m.pickSub, accent: true },
    { to: "/calendar?mine=1", icon: <Calendar />, title: m.calendar, sub: m.calendarSub },
    { to: "/stats", icon: <Chart />, title: m.stats, sub: m.statsSub },
    { to: "/together", icon: <Users />, title: m.together, sub: m.togetherSub },
  ];
  return (
    <nav className="qlinks w4" aria-label={m.pick}>
      {items.map((i) => (
        <Link key={i.to} href={href(lang, i.to)} className={`qcard${i.accent ? " accent" : ""}`}>
          <span className="qicon">{i.icon}</span>
          <span className="qtext"><b>{i.title}</b><small>{i.sub}</small></span>
          <span className="qarrow"><Arrow /></span>
        </Link>
      ))}
    </nav>
  );
}
