/**
 * Robot, ktorý beží stále (v Dockeri ako služba `worker`):
 *  - každú noc o 03:15 stiahne seriály a filmy z TMDB a hodnotenia z OMDb,
 *  - každú hodinu obnoví seriály s práve vychádzajúcou epizódou a pošle upozornenia,
 *  - každých 6 hodín stiahne TV program (ak je nastavený TV_XMLTV_*).
 * Po každej úlohe dá vedieť monitoringu (Healthchecks.io), ak je nastavený.
 */
import cron from "node-cron";
import { sql } from "../src/lib/db";
import { cleanup, fullSync, hourlySync, migrate } from "./sync";
import { sendNotifications } from "./notify";
import { importTv, tvConfigured } from "./tv";

const TZ = process.env.TZ_DISPLAY ?? "Europe/Bratislava";
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

/** Ohlási monitoringu výsledok úlohy (https://healthchecks.io, zadarmo). */
async function ping(url: string | undefined, ok: boolean, msg = "") {
  if (!url) return;
  await fetch(ok ? url : `${url.replace(/\/$/, "")}/fail`, { method: "POST", body: msg.slice(0, 10000) }).catch(() => {});
}

let busy = false;
async function run(name: string, fn: () => Promise<unknown>, hc?: string) {
  if (busy) return log(`${name}: predchádzajúca úloha ešte beží, preskakujem`);
  busy = true;
  const t = Date.now();
  if (hc) fetch(`${hc.replace(/\/$/, "")}/start`, { method: "POST" }).catch(() => {});
  try {
    const res = await fn();
    const msg = `${name}: hotovo za ${Math.round((Date.now() - t) / 1000)} s ${res ? JSON.stringify(res) : ""}`;
    log(msg);
    await ping(hc, true, msg);
  } catch (e) {
    log(`${name}: CHYBA`, e);
    await ping(hc, false, String((e as Error)?.stack ?? e));
  } finally {
    busy = false;
  }
}

async function main() {
  for (let i = 0; ; i++) {
    try { await migrate(); break; } catch (e) {
      if (i > 30) throw e;
      log("Čakám na databázu…");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  cron.schedule("15 3 * * *", () => run("Nočná synchronizácia", async () => { const r = await fullSync(); await cleanup(); return r; }, process.env.HC_NIGHTLY_URL), { timezone: TZ });
  cron.schedule("5 * * * *", () => run("Hodinová obnova", async () => { await hourlySync(); await sendNotifications(); }, process.env.HC_HOURLY_URL), { timezone: TZ });

  if (tvConfigured()) cron.schedule("40 */6 * * *", () => run("TV program", importTv, process.env.HC_TV_URL), { timezone: TZ });

  const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM titles`;
  if (count === 0) {
    log("Databáza je prázdna, spúšťam prvú synchronizáciu hneď");
    await run("Prvá synchronizácia", fullSync, process.env.HC_NIGHTLY_URL);
  }
  if (tvConfigured()) {
    const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM tv_airings WHERE starts_at > now()`;
    if (n === 0) await run("TV program (prvý import)", importTv, process.env.HC_TV_URL);
  }
  log(`Robot beží (časové pásmo ${TZ})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
