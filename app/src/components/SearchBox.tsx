"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "./icons";

export default function SearchBox({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [, start] = useTransition();
  const router = useRouter();
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (q === initial) return;
    clearTimeout(t.current);
    t.current = setTimeout(() => start(() => router.replace(q.trim() ? `/hladat?q=${encodeURIComponent(q.trim())}` : "/hladat", { scroll: false })), 300);
    return () => clearTimeout(t.current);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form className="search" role="search" action="/hladat" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="q" style={{ display: "flex" }}><Search /><span hidden>Hľadať</span></label>
      <input id="q" name="q" type="search" placeholder="Seriál, herec alebo žáner" autoComplete="off" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
    </form>
  );
}
