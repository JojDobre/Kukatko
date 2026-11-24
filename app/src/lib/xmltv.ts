/**
 * Čítanie TV programu vo formáte XMLTV (štandard, ktorý vyrábajú EPG grabbery aj poskytovatelia).
 * Zámerne bez knižnice: formát je jednoduchý a súbory môžu mať desiatky MB.
 */

export type XChannel = { id: string; name: string; icon: string | null };
export type XProgramme = {
  channel: string; start: Date; stop: Date | null; title: string; subTitle: string | null;
  year: number | null; category: string | null; season: number | null; episode: number | null;
};

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENT[e.toLowerCase()] ?? m;
    })
    .trim();
}

const attr = (attrs: string, name: string) => {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? decode(m[2] ?? m[3] ?? "") : null;
};

/** Všetky výskyty tagu: [atribúty, obsah]. */
function tags(body: string, name: string): [string, string][] {
  const out: [string, string][] = [];
  const re = new RegExp(`<${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${name}>)`, "gi");
  for (const m of body.matchAll(re)) out.push([m[1] ?? "", m[2] ?? ""]);
  return out;
}

/** Text tagu, prednostne v danom jazyku (XMLTV môže mať názov vo viacerých jazykoch). */
function text(body: string, name: string, langs: string[]) {
  const all = tags(body, name);
  if (!all.length) return null;
  for (const l of langs) {
    const hit = all.find(([a]) => attr(a, "lang")?.toLowerCase().startsWith(l));
    if (hit) return decode(hit[1]) || null;
  }
  return decode(all[0][1]) || null;
}

/** Čas XMLTV „20261124203000 +0100“ (zóna je voliteľná, inak UTC). */
export function parseTime(v: string | null): Date | null {
  const m = v?.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*(?:([+-])(\d{2}):?(\d{2}))?/);
  if (!m) return null;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  const off = m[7] ? (m[7] === "+" ? 1 : -1) * (+m[8] * 60 + +m[9]) : 0;
  return new Date(utc - off * 60000);
}

/** Číslo epizódy: xmltv_ns „1.4.0/1“ (od nuly) alebo na obrazovke „S02E05“. */
export function parseEpisode(body: string): { season: number | null; episode: number | null } {
  for (const [a, v] of tags(body, "episode-num")) {
    const sys = attr(a, "system");
    const t = decode(v);
    if (sys === "xmltv_ns") {
      const [s, e] = t.split(".").map((x) => parseInt(x.split("/")[0], 10));
      return { season: Number.isFinite(s) ? s + 1 : null, episode: Number.isFinite(e) ? e + 1 : null };
    }
    const m = t.match(/S(\d+)\s*E(\d+)/i);
    if (m) return { season: +m[1], episode: +m[2] };
  }
  return { season: null, episode: null };
}

export function parseXmltv(xml: string, langs: string[] = []) {
  const channels: XChannel[] = [];
  for (const m of xml.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi)) {
    const id = attr(m[1], "id");
    if (!id) continue;
    const icon = tags(m[2], "icon")[0];
    channels.push({ id, name: text(m[2], "display-name", langs) ?? id, icon: icon ? attr(icon[0], "src") : null });
  }
  const programmes: XProgramme[] = [];
  for (const m of xml.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi)) {
    const channel = attr(m[1], "channel");
    const start = parseTime(attr(m[1], "start"));
    const title = text(m[2], "title", langs);
    if (!channel || !start || !title) continue;
    const date = text(m[2], "date", []);
    const year = date && /^\d{4}/.test(date) ? +date.slice(0, 4) : null;
    programmes.push({
      channel, start, stop: parseTime(attr(m[1], "stop")), title, subTitle: text(m[2], "sub-title", langs),
      year: year && year > 1890 && year < 2100 ? year : null,
      category: tags(m[2], "category").map(([, v]) => decode(v)).filter(Boolean).join(", ") || null,
      ...parseEpisode(m[2]),
    });
  }
  return { channels, programmes };
}

/**
 * Názov na porovnávanie: malé písmená, bez diakritiky a interpunkcie,
 * bez prípon typu „(12)“, „II.“ v zátvorke, „- premiéra“, „HD“.
 */
export function normTitle(s: string) {
  return s
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*\((?:\d+|[ivx]+\.?|r|p|premi[ée]ra|repr[ií]za|tit\.?|st\.?|hd)\)\s*$/gi, "")
    .replace(/\s+-\s+(premi[eé]ra|repr[ií]za)$/i, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Vyzerá relácia ako film alebo seriál (oproti správam, športu, reklame)? */
export function looksLikeTitle(p: Pick<XProgramme, "category" | "year" | "season" | "episode">) {
  if (p.year || p.season || p.episode) return true;
  const c = (p.category ?? "").toLowerCase();
  if (!c) return false;
  if (/(spravodaj|zpravodaj|news|sport|šport|počasie|počasí|weather|magaz|talk|reality|súťaž|soutěž|game show|teleshop|hudb|music)/.test(c)) return false;
  return /(film|movie|seri|series|drama|dráma|kom[eé]di|comedy|thriller|krimi|crime|horor|horror|sci|fantas|animov|animat|rozpr|dobrodr|adventure|akčn|akční|action|romant|western|rodinn|family|mystery|mysteri|vojnov|válečn|war|histor|životopis|životopis|biograph)/.test(c);
}
