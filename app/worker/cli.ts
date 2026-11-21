/** Ručné spúšťanie úloh: npm run sync | sync:hourly | notify | migrate | seed-demo | vapid */
import webpush from "web-push";
import { sql } from "../src/lib/db";
import { fullSync, hourlySync, migrate, syncRatings, syncShow } from "./sync";
import { sendNotifications } from "./notify";
import { seedDemo } from "./demo";

const [cmd, arg] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case "vapid": {
      const k = webpush.generateVAPIDKeys();
      console.log("Vlož do .env:\n");
      console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${k.publicKey}`);
      console.log(`VAPID_PRIVATE_KEY=${k.privateKey}`);
      return;
    }
    case "migrate": await migrate(); break;
    case "sync": await migrate(); arg ? await syncShow(Number(arg)) : await fullSync(); break;
    case "hourly": await hourlySync(); break;
    case "ratings": await syncRatings(); break;
    case "notify": await sendNotifications(); break;
    case "seed-demo": await migrate(); await seedDemo(); break;
    default:
      console.log("Použitie: tsx worker/cli.ts <migrate|sync [tmdbId]|hourly|ratings|notify|seed-demo|vapid>");
      process.exitCode = 1;
  }
  await sql.end();
}

main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
