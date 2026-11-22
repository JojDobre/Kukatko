"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "./I18n";
import { toast } from "./toast";

export type ReviewRow = { id: number; nickname: string | null; body: string; date: string; rating: number | null; mine: boolean; status: string };

export default function Reviews({ titleId, reviews, mine, season = 0, episode = 0 }: { titleId: number; reviews: ReviewRow[]; mine: ReviewRow | null; season?: number; episode?: number }) {
  const { d } = useI18n();
  const r = d.reviews;
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<Set<number>>(new Set());
  const [, start] = useTransition();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 20) return toast(r.tooShort);
    setBusy(true);
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titleId, season, episode, nickname: nick, body }) }).catch(() => null);
    setBusy(false);
    const j = await res?.json().catch(() => ({}));
    if (!res?.ok) return toast(j?.error === "limit" ? r.limit : j?.error === "short" ? r.tooShort : d.follow.saveError);
    toast(j.status === "pending" ? r.pending : r.published);
    setOpen(false); setBody("");
    start(() => router.refresh());
  }
  async function report(id: number) {
    setReported(new Set(reported).add(id));
    await fetch("/api/reviews/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
    toast(r.reported);
  }
  async function remove() {
    await fetch("/api/reviews", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titleId, season, episode }) }).catch(() => null);
    toast(r.deleted);
    start(() => router.refresh());
  }

  return (
    <>
      {mine && (
        <div className="review mine">
          <div className="rhead"><b>{r.yours}</b>{mine.status === "pending" && <span className="chipday">{r.waiting}</span>}<button className="link" onClick={remove}>{r.delete}</button></div>
          <p>{mine.body}</p>
        </div>
      )}
      {reviews.length === 0 && !mine && <p className="muted">{r.none}</p>}
      {reviews.map((x) => (
        <div key={x.id} className="review">
          <div className="rhead">
            <b>{x.nickname || r.anonymous}</b>
            {x.rating != null && <span className="chipday">{x.rating}/10</span>}
            <small className="muted">{x.date}</small>
            {!x.mine && <button className="link" disabled={reported.has(x.id)} onClick={() => report(x.id)}>{reported.has(x.id) ? r.reported : r.report}</button>}
          </div>
          <p>{x.body}</p>
        </div>
      ))}
      {!mine && (open ? (
        <form className="rform" onSubmit={submit}>
          <label htmlFor="rnick" hidden>{r.nickname}</label>
          <input id="rnick" className="inp" placeholder={r.nickname} maxLength={30} value={nick} onChange={(e) => setNick(e.target.value)} />
          <label htmlFor="rbody" hidden>{r.write}</label>
          <textarea id="rbody" className="inp" rows={4} maxLength={2000} placeholder={r.placeholder} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="frow"><button className="btn" disabled={busy}>{r.submit}</button><small className="muted">{body.trim().length}/2000</small></div>
        </form>
      ) : <button className="btn soft" onClick={() => setOpen(true)}>{r.write}</button>)}
    </>
  );
}
