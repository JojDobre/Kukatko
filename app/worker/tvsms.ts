/**
 * Vstavaný verejný zdroj TV programu pre Slovensko a Česko: mobilná verzia tvprogram.cz (m.tv.sms.cz).
 * Rovnaký zdroj používa open-source projekt iptv-org/epg. Sťahujeme len vybrané stanice,
 * jednu stránku za druhou s pauzou, aby sme web nezaťažovali.
 */
import { execFile } from "node:child_process";
import https from "node:https";
import type { XChannel, XProgramme } from "../src/lib/xmltv";
import { decode } from "../src/lib/xmltv";

type Ch = { site: string; id: string; name: string; regions: ("SK" | "CZ")[]; films?: boolean };

/** Stanice: site = id na tvprogram.cz (v kódovaní windows-1250), films = vysiela len filmy. */
export const SMS_CHANNELS: Ch[] = [
  // Slovensko
  { site: "STV1", id: "jednotka", name: "Jednotka", regions: ["SK"] },
  { site: "STV2", id: "dvojka", name: "Dvojka", regions: ["SK"] },
  { site: "Mark%EDza", id: "markiza", name: "Markíza", regions: ["SK"] },
  { site: "Doma", id: "doma", name: "Doma", regions: ["SK"] },
  { site: "TV+DAJTO", id: "dajto", name: "Dajto", regions: ["SK"] },
  { site: "Mark%EDza+KRIMI", id: "markiza-krimi", name: "Markíza Krimi", regions: ["SK"] },
  { site: "JOJ", id: "joj", name: "JOJ", regions: ["SK"] },
  { site: "JOJ+Plus", id: "joj-plus", name: "JOJ Plus", regions: ["SK"] },
  { site: "WAU", id: "wau", name: "WAU", regions: ["SK"] },
  { site: "JOJ+Cinema", id: "joj-cinema", name: "JOJ Cinema", regions: ["SK"], films: true },
  { site: "JOJ+Family", id: "joj-family", name: "JOJ Family", regions: ["SK"] },
  { site: "Prima+SK", id: "prima-sk", name: "Prima SK", regions: ["SK"] },
  // Česko
  { site: "%C8T1", id: "ct1", name: "ČT1", regions: ["CZ"] },
  { site: "%C8T2", id: "ct2", name: "ČT2", regions: ["CZ"] },
  { site: "Nova", id: "nova", name: "Nova", regions: ["CZ"] },
  { site: "Nova+Cinema", id: "nova-cinema", name: "Nova Cinema", regions: ["CZ", "SK"], films: true },
  { site: "Nova+Action", id: "nova-action", name: "Nova Action", regions: ["CZ"] },
  { site: "Nova+Fun", id: "nova-fun", name: "Nova Fun", regions: ["CZ"] },
  { site: "Nova+Gold", id: "nova-gold", name: "Nova Gold", regions: ["CZ"] },
  { site: "Nova+Lady", id: "nova-lady", name: "Nova Lady", regions: ["CZ"] },
  { site: "Prima", id: "prima", name: "Prima", regions: ["CZ"] },
  { site: "Prima+Cool", id: "prima-cool", name: "Prima Cool", regions: ["CZ"] },
  { site: "Prima+MAX", id: "prima-max", name: "Prima Max", regions: ["CZ"] },
  { site: "Prima+LOVE", id: "prima-love", name: "Prima Love", regions: ["CZ"] },
  { site: "Prima+Krimi", id: "prima-krimi", name: "Prima Krimi", regions: ["CZ"] },
  { site: "Prima+Star", id: "prima-star", name: "Prima Star", regions: ["CZ"] },
  { site: "Barrandov", id: "barrandov", name: "Barrandov", regions: ["CZ"] },
  { site: "Kino+Barrandov", id: "kino-barrandov", name: "Kino Barrandov", regions: ["CZ"], films: true },
  { site: "CS+Film", id: "cs-film", name: "CS Film", regions: ["CZ", "SK"], films: true },
  { site: "Film%2B", id: "film-plus", name: "Film+", regions: ["CZ", "SK"], films: true },
  { site: "Paramount+Network", id: "paramount", name: "Paramount Network", regions: ["CZ", "SK"] },
  // Platené filmové stanice (rovnaké na Slovensku aj v Česku)
  { site: "HBO", id: "hbo", name: "HBO", regions: ["CZ", "SK"] },
  { site: "HBO2", id: "hbo2", name: "HBO 2", regions: ["CZ", "SK"] },
  { site: "HBO3", id: "hbo3", name: "HBO 3", regions: ["CZ", "SK"] },
  { site: "Cinemax", id: "cinemax", name: "Cinemax", regions: ["CZ", "SK"], films: true },
  { site: "Cinemax+2", id: "cinemax2", name: "Cinemax 2", regions: ["CZ", "SK"], films: true },
  { site: "AXN", id: "axn", name: "AXN", regions: ["CZ", "SK"] },
  { site: "AMC", id: "amc", name: "AMC", regions: ["CZ", "SK"] },
  { site: "Filmbox", id: "filmbox", name: "Filmbox", regions: ["CZ", "SK"], films: true },
  { site: "Filmbox+Premium", id: "filmbox-premium", name: "Filmbox Premium", regions: ["CZ", "SK"], films: true },
  { site: "Filmbox+Extra+HD", id: "filmbox-extra", name: "Filmbox Extra", regions: ["CZ", "SK"], films: true },
  { site: "Filmbox+Stars", id: "filmbox-stars", name: "Filmbox Stars", regions: ["CZ", "SK"], films: true },
  { site: "Film+Europe", id: "film-europe", name: "Film Europe", regions: ["CZ", "SK"], films: true },
  { site: "Epic+Drama", id: "epic-drama", name: "Epic Drama", regions: ["CZ", "SK"] },
];

// Web beží na staršom nastavení TLS: bez SECLEVEL=0 Node spojenie odmietne.
const CIPHERS = "DEFAULT@SECLEVEL=0";
const UA = "Kukatko-TV/1.0";

function viaNode(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA, Accept: "*/*" }, ciphers: CIPHERS, timeout: 30_000 }, (res) => {
      if ((res.statusCode ?? 0) >= 400) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c)).on("end", () => resolve(Buffer.concat(chunks))).on("error", reject);
    });
    req.on("error", reject).on("timeout", () => req.destroy(new Error("timeout")));
  });
}

function viaCurl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile("curl", ["-sSf", "--max-time", "30", "--ciphers", CIPHERS, "-A", UA, url], { encoding: "buffer", maxBuffer: 8 << 20 },
      (err, out) => (err ? reject(err) : resolve(out as Buffer)));
  });
}

/** Stiahne stránku: priamo cez Node, pri chybe cez curl. Za proxy (HTTPS_PROXY) alebo s TV_SMS_FETCH=curl hneď cez curl. */
export function get(url: string): Promise<Buffer> {
  const curl = process.env.TV_SMS_FETCH === "curl" || !!(process.env.HTTPS_PROXY || process.env.https_proxy);
  return curl ? viaCurl(url) : viaNode(url).catch(() => viaCurl(url));
}

const FILM = /(film|komedie|komédia|drama|dráma|thriller|horor|western|muzikál|pohádka|rozprávka|krimi|sci-fi|fantasy|akční|akčný|dobrodružný|romantick|animovaný|životopisný|válečný|vojnový|mysteriózní|psychologick)/i;
const SERIES = /(seriál|série|series|sitcom|epizoda|epizóda|díl\b|diel\b)/i;

/** Rozparsuje stránku jednej stanice za jeden deň (časy v miestnom čase Prahy/Bratislavy). */
export function parseSmsDay(html: string, dayISO: string, ch: Ch): XProgramme[] {
  const out: XProgramme[] = [];
  let dayShift = 0, prevMin = -1;
  const re = /<div class='porad'\s*>[\s\S]*?<span[^>]*>(\d{1,2})\.(\d{2})<\/span>[\s\S]*?<a class='nazev'[^>]*><div[^>]*>([\s\S]*?)<div class='ztr'>(?:(?:(?!class='porad')[\s\S])*?<div class='detail'>([\s\S]*?)<div class='ztr'>)?/g;
  for (const m of html.matchAll(re)) {
    const min = +m[1] * 60 + +m[2];
    if (min < prevMin) dayShift = 1; // po polnoci
    prevMin = min;
    const title = decode(m[3].replace(/<[^>]+>/g, ""));
    const detail = decode((m[4] ?? "").replace(/<[^>]+>/g, ""));
    if (!title) continue;
    const head = detail.split(/[.(]/)[0] ?? "";
    const year = detail.match(/\((\d{4})\)/)?.[1];
    const ep = title.match(/\((\d{1,4})\)\s*$/)?.[1] ?? title.match(/\b(\d{1,3})\/\d{1,3}\s*$/)?.[1];
    const category = ch.films || (FILM.test(head) && !SERIES.test(head)) ? "Film" : SERIES.test(head) || ep ? "Seriál" : null;
    // Seriál „Kobra 11 XXV (12)“: rímske číslo = sezóna, v zátvorke diel. Rok pri seriáli je rok vysielania, nie vzniku.
    let name = title, season: number | null = null;
    const rm = category === "Seriál" ? title.match(/^(.*\S)\s+([IVXLC]{1,7})(\s*\(\d+\))?$/) : null;
    if (rm && roman(rm[2])) { name = rm[1] + (rm[3] ?? ""); season = roman(rm[2]); }
    out.push({
      channel: ch.id, start: pragueToUtc(dayISO, min, dayShift), stop: null, title: name,
      subTitle: null, year: year && category !== "Seriál" ? +year : null, category, season, episode: ep && category === "Seriál" ? +ep : null,
    });
  }
  return out;
}

function roman(r: string) {
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let n = 0;
  for (let i = 0; i < r.length; i++) n += v[r[i]] < (v[r[i + 1]] ?? 0) ? -v[r[i]] : v[r[i]];
  return n > 0 && n < 200 ? n : null;
}

/** Miestny čas Prahy (= Bratislavy) na UTC, aj so zmenou letného času. */
function pragueToUtc(dayISO: string, min: number, shift: number) {
  const [y, mo, d] = dayISO.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d + shift, Math.floor(min / 60), min % 60);
  const off = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(t);
    const g = (k: string) => +parts.find((p) => p.type === k)!.value;
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - t;
  };
  return new Date(guess - off(guess - off(guess)));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Stiahne program vybraných staníc na `days` dní (dnes + ďalšie). Výsledok je rozdelený podľa krajiny. */
export async function grabSms(days: number, log: (...a: unknown[]) => void) {
  const pauseMs = Number(process.env.TV_SMS_PAUSE_MS ?? 1200);
  const byRegion: Record<"SK" | "CZ", { channels: XChannel[]; programmes: XProgramme[] }> = { SK: { channels: [], programmes: [] }, CZ: { channels: [], programmes: [] } };
  const want = (process.env.TV_SMS_CHANNELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const list = want.length ? SMS_CHANNELS.filter((c) => want.includes(c.id)) : SMS_CHANNELS;
  let errors = 0;
  for (const ch of list) {
    const progs: XProgramme[] = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(Date.now() + i * 86400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" });
      try {
        const html = new TextDecoder("windows-1250").decode(await get(`https://m.tv.sms.cz/index.php?stanice=${ch.site}&cas=0&den=${day}`));
        progs.push(...parseSmsDay(html, day, ch));
      } catch (e) {
        errors++;
        log(`TV ${ch.name} ${day}:`, (e as Error).message);
      }
      await sleep(pauseMs);
    }
    // Duplicity na hranici dní (relácie po polnoci sú na oboch stránkach).
    const uniq = [...new Map(progs.map((p) => [+p.start, p])).values()];
    for (const r of ch.regions) {
      byRegion[r].channels.push({ id: ch.id, name: ch.name, icon: null });
      byRegion[r].programmes.push(...uniq);
    }
  }
  return { byRegion, errors, channels: list.length };
}
