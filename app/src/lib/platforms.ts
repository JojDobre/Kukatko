/** Farby a skratky známych platforiem. Neznáme platformy dostanú farbu podľa názvu. */
const KNOWN: { match: RegExp; short: string; color: string }[] = [
  { match: /netflix/i, short: "NFX", color: "#D81F26" },
  { match: /hbo|^max$/i, short: "MAX", color: "#5B2BE0" },
  { match: /disney/i, short: "D+", color: "#1A3FA0" },
  { match: /skyshowtime/i, short: "SKY", color: "#0B6E8E" },
  { match: /voyo/i, short: "VOYO", color: "#E0157A" },
  { match: /amazon|prime/i, short: "PRM", color: "#1399C6" },
  { match: /apple/i, short: "ATV", color: "#3A3A3C" },
  { match: /oneplay/i, short: "ONE", color: "#FF2E63" },
  { match: /mubi/i, short: "MUBI", color: "#1C1C1C" },
  { match: /canal/i, short: "C+", color: "#111111" },
];

export function platformStyle(name: string) {
  const k = KNOWN.find((p) => p.match.test(name));
  if (k) return { short: k.short, color: k.color };
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return { short: name.replace(/[^A-Za-z0-9+]/g, "").slice(0, 4).toUpperCase(), color: `hsl(${h} 55% 40%)` };
}

/**
 * Affiliate odkazy. Ak pre platformu máš affiliate program, doplň sem URL
 * (napr. z Awin/CJ). Inak sa použije odkaz z TMDB/JustWatch.
 */
export const AFFILIATE: Record<string, string> = {
  // "Netflix": "https://...",
};
