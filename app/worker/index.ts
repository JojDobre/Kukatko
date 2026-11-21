/**
 * Robot, ktorý beží stále (v Dockeri ako služba `worker`):
 *  - každú noc o 03:15 stiahne seriály z TMDB a hodnotenia z OMDb,
 *  - každú hodinu obnoví seriály s práve vychádzajúcou epizódou a pošle upozornenia.
 */
import cron from "node-cron";
import { sql } from "../src/lib/db";
import { fullSync, hourlySync, migrate } from "./sync";
import { sendNotifications } from "./notify";

const TZ = process.env.TZ_DISPLAY ?? "Europe/Bratislava";
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

let busy = false;
async function run(name: string, fn: () => Promise<void>) {
  if (busy) return log(`${name}: predchádzajúca úloha ešte beží, preskakujem`);
  busy = true;
  const t = Date.now();
  try {
    await fn();
    log(`${name}: hotovo za ${Math.round((Date.now() - t) / 1000)} s`);
  } catch (e) {
    log(`${name}: CHYBA`, e);
  } finally {
    busy = false;
  }
}

async function main() {
  // Databáza v Dockeri môže štartovať o chvíľu dlhšie.
  for (let i = 0; ; i++) {
    try { await migrate(); break; } catch (e) {
      if (i > 30) throw e;
      log("Čakám na databázu…");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  cron.schedule("15 3 * * *", () => run("Nočná synchronizácia", fullSync), { timezone: TZ });
  cron.schedule("5 * * * *", () => run("Hodinová obnova", async () => { await hourlySync(); await sendNotifications(); }), { timezone: TZ });

  const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM shows`;
  if (count === 0) {
    log("Databáza je prázdna, spúšťam prvú synchronizáciu hneď");
    await run("Prvá synchronizácia", fullSync);
  }
  log(`Robot beží (časové pásmo ${TZ})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
