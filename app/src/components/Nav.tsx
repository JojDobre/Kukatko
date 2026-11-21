"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Grid, List, Search, User } from "./icons";

const ITEMS = [
  { href: "/", label: "Domov", icon: <Grid /> },
  { href: "/katalog", label: "Katalóg", icon: <List /> },
  { href: "/hladat", label: "Hľadať", icon: <Search size={22} /> },
  { href: "/sledujem", label: "Sledujem", icon: <Bell /> },
  { href: "/profil", label: "Profil", icon: <User /> },
];

const active = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function TopNav({ badge }: { badge: number }) {
  const path = usePathname();
  return (
    <>
      <nav className="nav" aria-label="Sekcie">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(path, i.href) ? "page" : undefined}>{i.label}</Link>
        ))}
      </nav>
      <Link className="round" href="/sledujem" aria-label={`Upozornenia${badge ? `: ${badge} tento týždeň` : ""}`}>
        <Bell />
        {badge > 0 && <span className="dotc">{badge}</span>}
      </Link>
    </>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Sekcie">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(path, i.href) ? "page" : undefined}>{i.icon}{i.label}</Link>
      ))}
    </nav>
  );
}
