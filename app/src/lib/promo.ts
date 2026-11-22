import { sql } from "./db";
import type { Lang } from "./locales";

export type Promo = { id: number; headline: string; body: string | null; image_url: string | null; poster_path: string | null };

/** Jeden aktívny odporúčaný (predaný) box pre jazyk. Započíta zobrazenie. */
export async function activePromo(lang: Lang): Promise<Promo | null> {
  const [p] = await sql<Promo[]>`
    SELECT p.id, p.headline, p.body, p.image_url, t.poster_path FROM promos p LEFT JOIN titles t ON t.id = p.title_id
    WHERE p.active AND current_date BETWEEN p.starts_at AND p.ends_at AND (cardinality(p.langs) = 0 OR ${lang} = ANY(p.langs))
    ORDER BY random() LIMIT 1`.catch(() => []);
  if (p) sql`UPDATE promos SET impressions = impressions + 1 WHERE id = ${p.id}`.catch(() => {});
  return p ?? null;
}
