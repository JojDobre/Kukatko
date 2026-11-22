import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { ensureDevice } from "./device";
import { allow, clientIp } from "./ratelimit";

type Opts = { limit?: [max: number, windowSec: number]; name?: string };

/** Spoločný obal pre API: obmedzenie požiadaviek, zariadenie, JSON telo a chyby. */
export function handler(fn: (deviceId: string, body: any) => Promise<unknown>, opts: Opts = {}) {
  return async (req: Request) => {
    try {
      const [max, win] = opts.limit ?? [120, 60];
      const ip = clientIp(await headers());
      if (!allow(`${opts.name ?? new URL(req.url).pathname}:${req.method}:${ip}`, max, win)) {
        return NextResponse.json({ error: "rate" }, { status: 429, headers: { "Retry-After": String(win) } });
      }
      const body = req.method === "GET" ? null : await req.json().catch(() => ({}));
      const dev = await ensureDevice();
      const out = await fn(dev, body);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof Response) return e;
      console.error(e);
      return NextResponse.json({ error: "Niečo sa pokazilo" }, { status: 500 });
    }
  };
}

export const bad = (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "Content-Type": "application/json" } });
