"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Calendar, Chart, Grid, List, Search, Tv, User } from "./icons";
import { useI18n } from "./I18n";
import LangSwitch from "./LangSwitch";
import { DEFAULT_LANG } from "@/lib/locales";

function useItems(tv = false) {
  const { d, href } = useI18n();
  return [
    { key: "home", href: href("/"), label: d.nav.home, icon: <Grid /> },
    { key: "catalog", href: href("/catalog"), label: d.nav.catalog, icon: <List /> },
    { key: "charts", href: href("/charts"), label: d.nav.charts, icon: <Chart /> },
    ...(tv ? [{ key: "tvguide", href: href("/tv-program"), label: d.tvguide.nav, icon: <Tv />, desktopOnly: true }] : []),
    { key: "calendar", href: href("/calendar"), label: d.more.calendar, icon: <Calendar />, desktopOnly: true },
    { key: "watchlist", href: href("/watchlist"), label: d.nav.watchlist, icon: <Bell /> },
    { key: "profile", href: href("/profile"), label: d.nav.profile, icon: <User /> },
  ];
}

// Proxy prepisuje adresy bez predpony na /sk/…, preto porovnávame bez predvoleného jazyka.
const norm = (p: string) => p.replace(new RegExp(`^/${DEFAULT_LANG}(?=/|$)`), "") || "/";
const isActive = (path: string, h: string, home: string) => {
  const p = norm(path), x = norm(h), hm = norm(home);
  return x === hm ? p === hm : p === x || p.startsWith(x + "/");
};

export function TopNav({ badge, tv }: { badge: number; tv: boolean }) {
  const path = usePathname();
  const items = useItems(tv);
  const { d, href, plural } = useI18n();
  return (
    <>
      <nav className="nav" aria-label={d.nav.home}>
        {items.map((i) => <Link key={i.key} href={i.href} aria-current={isActive(path, i.href, items[0].href) ? "page" : undefined}>{i.label}</Link>)}
      </nav>
      <LangSwitch />
      <Link className="round" href={href("/search")} aria-label={d.nav.search}><Search size={19} /></Link>
      <Link className="round hide-m" href={href("/watchlist")} aria-label={`${d.nav.notifications}${badge ? `: ${d.nav.thisWeekBadge.replace("{n}", String(badge))}` : ""}`}>
        <Bell />
        {badge > 0 && <span className="dotc">{badge}</span>}
      </Link>
    </>
  );
}

export function TabBar() {
  const path = usePathname();
  const items = useItems();
  return (
    <nav className="tabbar" aria-label="Menu">
      {items.filter((i) => !i.desktopOnly).map((i) => <Link key={i.key} href={i.href} aria-label={i.label} aria-current={isActive(path, i.href, items[0].href) ? "page" : undefined}>{i.icon}<span>{i.label}</span></Link>)}
    </nav>
  );
}
