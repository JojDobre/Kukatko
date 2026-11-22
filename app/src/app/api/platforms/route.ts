import { bad, handler } from "@/lib/api";
import { savePlatforms } from "@/lib/features";
import { REGIONS } from "@/lib/locales";

/** Uloží vybrané platformy zariadenia (pre upozornenia a „Pozerajte spolu“). */
export const POST = handler(async (dev, b) => {
  const region = String(b?.region ?? "");
  if (!(REGIONS as string[]).includes(region)) throw bad("Neznámy región");
  const ids = (Array.isArray(b?.ids) ? b.ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 40);
  await savePlatforms(dev, region, ids);
  return { ok: true };
});
