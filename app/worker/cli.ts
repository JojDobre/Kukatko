/** Ručné spúšťanie úloh: tsx worker/cli.ts <príkaz> */
import webpush from "web-push";
import { sql } from "../src/lib/db";
import { cleanup, fullSync, hourlySync, migrate, syncFollowedSeasons, syncRatings } from "./sync";
import { syncTitle } from "../src/lib/sync";
import { sendNotifications } from "./notify";
import { seedDemo } from "./demo";
import { importTv } from "./tv";

const [cmd, a1, a2] = process.argv.slice(2);

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
    case "sync":
      await migrate();
      if (a1 === "tv" || a1 === "movie") await syncTitle(a1, Number(a2));
      else await fullSync();
      break;
    case "hourly": await hourlySync(); break;
    case "seasons": await syncFollowedSeasons(); break;
    case "ratings": await syncRatings(); break;
    case "notify": await sendNotifications(); break;
    case "tv": await migrate(); console.log(await importTv()); break;
    case "cleanup": await cleanup(); break;
    case "seed-demo": await migrate(); await seedDemo(); break;
    default:
      console.log("Použitie: tsx worker/cli.ts <migrate|sync [tv|movie tmdbId]|hourly|seasons|ratings|notify|tv|cleanup|seed-demo|vapid>");
      process.exitCode = 1;
  }
  await sql.end();
}

main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
