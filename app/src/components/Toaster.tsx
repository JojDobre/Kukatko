"use client";
import { useEffect, useRef, useState } from "react";

export default function Toaster() {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const h = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      setOn(true);
      clearTimeout(t.current);
      t.current = setTimeout(() => setOn(false), 2200);
    };
    window.addEventListener("kuk:toast", h);
    return () => window.removeEventListener("kuk:toast", h);
  }, []);
  return <div className={`toast${on ? " on" : ""}`} role="status" aria-live="polite">{msg}</div>;
}
