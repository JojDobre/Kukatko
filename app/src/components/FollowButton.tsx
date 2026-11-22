"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell } from "./icons";
import { toast } from "./toast";
import { useI18n } from "./I18n";
import { currentSubscription, enablePush, pushSupported } from "./push-client";

type Props = { titleId: number; name: string; initial: boolean; variant: "icon" | "ghost" | "full"; hint: string; kind?: "tv" | "movie" };

export default function FollowButton({ titleId, name, initial, variant, hint, kind = "tv" }: Props) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  const router = useRouter();
  const { d, fmt } = useI18n();

  async function click(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !on;
    setOn(next);
    const res = await fetch("/api/follow", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titleId, on: next }),
    }).catch(() => null);
    if (!res?.ok) { setOn(!next); return toast(d.follow.saveError); }
    toast(next ? hint : fmt(d.follow.toastOff, { name }));
    // Pri prvom sledovaní rovno ponúkneme zapnutie upozornení.
    if (next && pushSupported() && Notification.permission === "default" && !(await currentSubscription())) {
      enablePush().then((ok) => ok && toast(d.follow.pushOn));
    }
    start(() => router.refresh());
  }

  const label = fmt(d.follow.aria, { name });
  if (variant === "icon")
    return <button className="bl" aria-pressed={on} aria-label={label} onClick={click}><Bell on={on} /></button>;
  if (variant === "ghost")
    return <button className="btn ghost" aria-pressed={on} onClick={click}><Bell on={on} />{on ? d.follow.following : d.follow.short}</button>;
  return (
    <button className={`btn wide${on ? " soft" : ""}`} aria-pressed={on} onClick={click}>
      <Bell on={on} />{on ? d.follow.followingFull : kind === "movie" ? d.follow.fullMovie : d.follow.fullTv}
    </button>
  );
}
