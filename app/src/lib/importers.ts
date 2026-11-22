/**
 * Čítanie exportov z IMDb, Letterboxd a Trakt. Čisté funkcie bez databázy (dajú sa testovať).
 * Výsledok: zoznam akcií „ohodnotiť“, „chcem vidieť“ a „pozreté“ s identifikátormi titulu.
 */
export type ImportItem = {
  action: "rate" | "want" | "seen";
  value?: number;                  // hodnotenie 1–10
  imdb?: string; tmdb?: number; kind?: "tv" | "movie";
  title?: string; year?: number;
};

/** CSV s úvodzovkami a čiarkami v texte. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const imdbKind = (type: string): "tv" | "movie" | undefined =>
  /^tv(Series|MiniSeries)$|^TV (Series|Mini Series)$/i.test(type) ? "tv" : /^(movie|tvMovie|TV Movie|Movie|video)$/i.test(type) ? "movie" : undefined;

export function parseImport(fileName: string, text: string): { source: "imdb" | "letterboxd" | "trakt"; items: ImportItem[] } {
  const name = fileName.toLowerCase();
  const trimmed = text.trim();

  // Trakt: JSON
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const data = JSON.parse(trimmed);
    const arr: any[] = Array.isArray(data) ? data : data.items ?? [];
    const items: ImportItem[] = [];
    for (const x of arr) {
      const kind = x.movie ? "movie" : x.show ? "tv" : undefined;
      const m = x.movie ?? x.show;
      if (!kind || !m) continue;
      const base = { kind, imdb: m.ids?.imdb || undefined, tmdb: m.ids?.tmdb || undefined, title: m.title, year: m.year } as const;
      if (typeof x.rating === "number") items.push({ action: "rate", value: Math.max(1, Math.min(10, Math.round(x.rating))), ...base });
      else if (x.listed_at || name.includes("watchlist")) items.push({ action: "want", ...base });
      else if (kind === "movie" && (x.watched_at || x.last_watched_at || x.plays)) items.push({ action: "seen", ...base });
    }
    return { source: "trakt", items };
  }

  const rows = parseCsv(text);
  if (!rows.length) return { source: "imdb", items: [] };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n: string) => head.indexOf(n);

  // IMDb: stĺpec „Const“ (tt…)
  if (col("const") >= 0) {
    const iC = col("const"), iR = col("your rating"), iT = col("title type"), iN = col("title"), iY = col("year");
    const items: ImportItem[] = [];
    for (const r of rows.slice(1)) {
      const imdb = r[iC]?.trim();
      if (!/^tt\d+$/.test(imdb ?? "")) continue;
      const kind = iT >= 0 ? imdbKind(r[iT]?.trim() ?? "") : undefined;
      if (iT >= 0 && !kind) continue; // epizódy, krátke filmy, hry…
      const base = { imdb, kind, title: r[iN], year: Number(r[iY]) || undefined };
      const v = iR >= 0 ? Number(r[iR]) : NaN;
      if (iR >= 0 && v >= 1 && v <= 10) items.push({ action: "rate", value: Math.round(v), ...base });
      else if (iR < 0) items.push({ action: "want", ...base });
    }
    return { source: "imdb", items };
  }

  // Letterboxd: „Name“, „Year“, „Letterboxd URI“ (iba filmy)
  if (col("letterboxd uri") >= 0 && col("name") >= 0) {
    const iN = col("name"), iY = col("year"), iR = col("rating");
    const items: ImportItem[] = [];
    for (const r of rows.slice(1)) {
      const title = r[iN]?.trim();
      if (!title) continue;
      const base = { kind: "movie" as const, title, year: Number(r[iY]) || undefined };
      const stars = iR >= 0 ? Number(r[iR]) : NaN;               // 0,5 až 5 hviezdičiek
      if (iR >= 0 && stars > 0) items.push({ action: "rate", value: Math.max(1, Math.min(10, Math.round(stars * 2))), ...base });
      else if (name.includes("watchlist")) items.push({ action: "want", ...base });
      else items.push({ action: "seen", ...base });
    }
    return { source: "letterboxd", items };
  }
  throw new Error("Neznámy formát súboru");
}
