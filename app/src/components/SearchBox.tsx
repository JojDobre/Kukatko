"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "./icons";
import { useI18n } from "./I18n";

export default function SearchBox({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [, start] = useTransition();
  const router = useRouter();
  const { d, href } = useI18n();
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (q === initial) return;
    clearTimeout(t.current);
    const base = href("/search");
    t.current = setTimeout(() => start(() => router.replace(q.trim() ? `${base}?q=${encodeURIComponent(q.trim())}` : base, { scroll: false })), 300);
    return () => clearTimeout(t.current);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form className="search" role="search" action={href("/search")} onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="q" style={{ display: "flex" }}><Search /><span hidden>{d.search.title}</span></label>
      <input id="q" name="q" type="search" placeholder={d.search.placeholder} autoComplete="off" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
    </form>
  );
}
