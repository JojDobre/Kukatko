/** Stav filtrov katalógu a jeho adresa. Zdieľané medzi serverom (stránkovanie) a klientom (filtre). */
export type FilterState = {
  kind: "all" | "tv" | "movie"; sort: string; genre: string | null; year: number | null;
  runtime: "short" | "medium" | "long" | null; score: number | null; lang: string | null;
  all: boolean; view: "grid" | "list";
};

export function catalogQuery(s: FilterState) {
  const q = new URLSearchParams();
  if (s.kind !== "all") q.set("kind", s.kind);
  if (s.sort !== "score") q.set("sort", s.sort);
  if (s.genre) q.set("genre", s.genre);
  if (s.year) q.set("year", String(s.year));
  if (s.runtime) q.set("runtime", s.runtime);
  if (s.score) q.set("score", String(s.score));
  if (s.lang) q.set("lang", s.lang);
  if (s.all) q.set("all", "1");
  if (s.view === "list") q.set("view", "list");
  return q.size ? `?${q}` : "";
}
