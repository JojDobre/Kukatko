import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { sql } from "@/lib/db";
import { deviceId } from "@/lib/device";
import { ensurePerson } from "@/lib/sync";
import { tmdbConfigured } from "@/lib/tmdb";
import { followedIds, type Card } from "@/lib/queries";
import { fmtDate, img } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { page, personHref } from "@/lib/page";
import { alternates } from "@/lib/seo";
import Poster from "@/components/Poster";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; slug: string }> };

type Person = { id: number; name: string; slug: string; profile_path: string | null; birthday: string | null; deathday: string | null;
  birthplace: string | null; known_for: string | null; bio: Record<string, string>; credits: { kind: string; tmdb_id: number; name: string; character: string | null; year: number | null }[] };

async function load(slug: string) {
  const id = Number(slug.split("-")[0]);
  if (!Number.isInteger(id) || id <= 0) notFound();
  if (tmdbConfigured()) await ensurePerson(id);
  const [p] = await sql<Person[]>`SELECT * FROM people WHERE id = ${id}`;
  if (p) return p;
  // Bez TMDB kľúča (alebo keď TMDB nevie): poskladáme aspoň meno a tituly z našej databázy.
  const rows = await sql<{ name: string; profile_path: string | null; kind: string; tmdb_id: number; title: string; year: number | null; character: string | null }[]>`
    SELECT c->>'name' AS name, c->>'profile_path' AS profile_path, t.kind, t.tmdb_id, t.original_name AS title, t.year, c->>'character' AS character
    FROM titles t, jsonb_array_elements(t."cast") c WHERE (c->>'id')::int = ${id}`;
  if (!rows.length) notFound();
  return { id, name: rows[0].name, slug: "", profile_path: rows[0].profile_path, birthday: null, deathday: null, birthplace: null, known_for: "Acting", bio: {},
    credits: rows.map((r) => ({ kind: r.kind, tmdb_id: r.tmdb_id, name: r.title, character: r.character, year: r.year })) } as Person;
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang, d } = await page(params);
  const p = await load((await params).slug);
  const bio = p.bio[lang] ?? p.bio.en;
  return {
    title: p.name,
    description: (bio ?? fmt(d.person.metaDesc, { name: p.name })).slice(0, 158),
    alternates: alternates(lang, () => `/person/${p.id}${p.slug ? `-${p.slug}` : ""}`),
    openGraph: { images: p.profile_path ? [img(p.profile_path, "h632")!] : [] },
  };
}

export default async function PersonPage({ params }: P) {
  const { lang, d, ctx } = await page(params);
  const { slug } = await params;
  const p = await load(slug);
  if (p.slug && slug !== `${p.id}-${p.slug}`) permanentRedirect(personHref(lang, p));
  const dev = await deviceId();
  // Ktoré z jeho titulov máme v katalógu (a teda vieme, kde sa dajú pozrieť).
  const keys = p.credits.map((c) => `${c.kind}:${c.tmdb_id}`);
  const [known, fol] = await Promise.all([
    keys.length ? sql<Card[]>`SELECT t.id, t.kind, t.tmdb_id,
        coalesce(t.i18n->${lang}->>'name', t.i18n->'en'->>'name', t.original_name) AS name,
        coalesce(t.i18n->${lang}->>'slug', t.i18n->'en'->>'slug', 'titul') AS slug, NULL AS overview,
        t.poster_path, t.backdrop_path, t.year, t.genre_ids, t.seasons, coalesce(t.providers->${ctx.region}, '[]'::jsonb) AS providers,
        t.next_ep, NULL AS next_ep_name, t.next_air_date, t.tmdb_rating, t.tmdb_votes, t.imdb_rating, t.rt_rating, t.user_avg, t.user_count, t.score
      FROM titles t WHERE (t.kind || ':' || t.tmdb_id) = ANY(${keys}::text[])
      ORDER BY (${ctx.region} = ANY(t.regions)) DESC, t.popularity DESC` : Promise.resolve([] as Card[]),
    followedIds(dev),
  ]);
  const knownKeys = new Set(known.map((k) => `${k.kind}:${k.tmdb_id}`));
  const other = p.credits.filter((c) => !knownKeys.has(`${c.kind}:${c.tmdb_id}`)).slice(0, 40);
  const bio = p.bio[lang] ?? p.bio.en;
  const dept = p.known_for ? (d.person.departments as Record<string, string>)[p.known_for] ?? p.known_for : null;
  const ld = { "@context": "https://schema.org", "@type": "Person", name: p.name, birthDate: p.birthday ?? undefined, deathDate: p.deathday ?? undefined,
    birthPlace: p.birthplace ?? undefined, image: p.profile_path ? img(p.profile_path, "h632") : undefined, description: bio?.slice(0, 300) };

  return (
    <div className="bento">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <section className="tile w4 phero">
        {p.profile_path ? <img className="pphoto" src={img(p.profile_path, "h632")!} alt={p.name} /> : <span className="pphoto avx">{p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: "clamp(28px,4vw,44px)" }}>{p.name}</h1>
          <dl className="facts">
            {dept && <><dt>{d.person.knownFor}</dt><dd>{dept}</dd></>}
            {p.birthday && <><dt>{d.person.born}</dt><dd>{fmtDate(p.birthday, lang, { day: "numeric", month: "long", year: "numeric" })}</dd></>}
            {p.deathday && <><dt>{d.person.died}</dt><dd>{fmtDate(p.deathday, lang, { day: "numeric", month: "long", year: "numeric" })}</dd></>}
            {p.birthplace && <><dt>{d.person.birthplace}</dt><dd>{p.birthplace}</dd></>}
          </dl>
          <p className="prose bio">{bio ?? d.person.noBio}</p>
        </div>
      </section>
      {known.length > 0 && (
        <div className="tile w4">
          <div className="lbl"><span>{d.person.filmography}</span><span>{known.length}</span></div>
          <div className="posters">{known.map((s) => <Poster key={s.id} s={s} lang={lang} followed={fol.has(s.id)} />)}</div>
        </div>
      )}
      {other.length > 0 && (
        <div className="tile w4">
          <div className="lbl"><span>{d.person.otherWork}</span></div>
          <ul className="credits">{other.map((c) => <li key={`${c.kind}${c.tmdb_id}`}><span className="mono muted">{c.year ?? "—"}</span> {c.name}{c.character ? <small className="muted"> · {c.character}</small> : null}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
