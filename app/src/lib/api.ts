import { NextResponse } from "next/server";
import { ensureDevice } from "./device";

/** Spoločný obal pre API: zariadenie, JSON telo a chyby. */
export function handler(fn: (deviceId: string, body: any) => Promise<unknown>) {
  return async (req: Request) => {
    try {
      const body = req.method === "GET" ? null : await req.json().catch(() => ({}));
      const dev = await ensureDevice();
      const out = await fn(dev, body);
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof Response) return e;
      console.error(e);
      return NextResponse.json({ error: "Niečo sa pokazilo" }, { status: 500 });
    }
  };
}

export const bad = (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "Content-Type": "application/json" } });
