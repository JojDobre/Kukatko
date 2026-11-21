"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell } from "./icons";
import { toast } from "./toast";
import { currentSubscription, enablePush, pushSupported } from "./push-client";

type Props = { showId: number; name: string; initial: boolean; variant: "icon" | "ghost" | "full"; nextLabel?: string };

export default function FollowButton({ showId, name, initial, variant, nextLabel }: Props) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  const router = useRouter();

  async function click(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !on;
    setOn(next);
    const res = await fetch("/api/follow", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showId, on: next }),
    }).catch(() => null);
    if (!res?.ok) { setOn(!next); return toast("Nepodarilo sa uložiť. Skús to znova."); }
    toast(next ? (nextLabel ? `Ozveme sa ${nextLabel}` : "Ozveme sa pri novej sezóne") : `Upozornenia pre ${name} vypnuté`);
    // Pri prvom sledovaní rovno ponúkneme zapnutie upozornení v telefóne/prehliadači.
    if (next && pushSupported() && Notification.permission === "default" && !(await currentSubscription())) {
      enablePush().then((ok) => ok && toast("Upozornenia zapnuté"));
    }
    start(() => router.refresh());
  }

  const label = `${on ? "Vypnúť" : "Zapnúť"} upozornenia: ${name}`;
  if (variant === "icon")
    return <button className="bl" aria-pressed={on} aria-label={label} onClick={click}><Bell on={on} /></button>;
  if (variant === "ghost")
    return <button className="btn ghost" aria-pressed={on} onClick={click}><Bell on={on} />{on ? "Sledujem" : "Upozorni ma"}</button>;
  return (
    <button className={`btn wide${on ? " soft" : ""}`} aria-pressed={on} onClick={click}>
      <Bell on={on} />{on ? "Sledujem, upozornenia zapnuté" : "Upozorni ma na nové epizódy"}
    </button>
  );
}
