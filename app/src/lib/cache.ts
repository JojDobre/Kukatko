/**
 * Jednoduchá pamäťová cache pre dopyty, ktoré sú rovnaké pre všetkých návštevníkov
 * (rebríčky, zoznam platforiem, najlepšie hodnotené…). Šetrí databázu pri náraste návštevnosti.
 * Platí v rámci jedného procesu webu, čo pri jednom VPS stačí.
 */
type Entry = { exp: number; p: Promise<unknown> };
const store = new Map<string, Entry>();
const MAX = 3000;
const off = () => process.env.CACHE_TTL === "0";

export function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  if (off()) return fn();
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) return hit.p as Promise<T>;
  const p = fn().catch((e) => { store.delete(key); throw e; });
  store.set(key, { exp: now + ttlSec * 1000, p });
  if (store.size > MAX) {
    for (const [k, v] of store) { if (v.exp <= now || store.size > MAX) store.delete(k); if (store.size <= MAX * 0.8) break; }
  }
  return p;
}

/** Predvolená dĺžka platnosti v sekundách (dáta sa menia raz za hodinu až deň). */
export const TTL = Number(process.env.CACHE_TTL ?? 300);

export function clearCache() { store.clear(); }
