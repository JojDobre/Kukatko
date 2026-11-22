import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function Admin() {
  if (!process.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN.length < 12) {
    return <div className="tile"><h1>Administrácia je vypnutá</h1><p className="muted">Nastav v .env premennú ADMIN_TOKEN (aspoň 12 znakov) a reštartuj web.</p></div>;
  }
  if (!(await isAdmin())) {
    return (
      <form className="tile set" method="post" action="/api/admin/login" style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: 24 }}>{SITE}: administrácia</h1>
        <label htmlFor="token" className="muted">Heslo (ADMIN_TOKEN)</label>
        <input id="token" name="token" type="password" className="inp" autoComplete="current-password" required />
        <button className="btn">Prihlásiť</button>
      </form>
    );
  }

  const promos = await sql<{ id: number; label: string; headline: string; url: string; langs: string[]; starts_at: string; ends_at: string; active: boolean; impressions: number; clicks: number }[]>`
    SELECT id, label, headline, url, langs, starts_at, ends_at, active, impressions, clicks FROM promos ORDER BY created_at DESC LIMIT 50`;
  const [queue, clicksByProv, topTitles, state, counts] = await Promise.all([
    sql<{ id: number; body: string; nickname: string | null; status: string; reports: number; created_at: Date; name: string; lang: string }[]>`
      SELECT r.id, r.body, r.nickname, r.status, r.reports, r.created_at, r.lang,
        t.original_name || CASE WHEN r.season > 0 THEN ' · S' || lpad(r.season::text, 2, '0') || 'E' || lpad(r.episode::text, 2, '0') ELSE '' END AS name
      FROM reviews r JOIN titles t ON t.id = r.title_id
      WHERE r.status = 'pending' OR r.reports > 0 OR r.created_at > now() - interval '2 days'
      ORDER BY (r.status = 'pending') DESC, r.reports DESC, r.created_at DESC LIMIT 100`,
    sql<{ name: string; region: string; clicks: number }[]>`
      SELECT coalesce(p.name, c.provider_id::text) AS name, c.region, sum(c.count)::int AS clicks
      FROM clicks c LEFT JOIN providers p ON p.id = c.provider_id
      WHERE c.day > current_date - 30 GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30`,
    sql<{ name: string; clicks: number }[]>`
      SELECT t.original_name AS name, sum(c.count)::int AS clicks FROM clicks c JOIN titles t ON t.id = c.title_id
      WHERE c.day > current_date - 30 GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
    sql<{ key: string; value: any; updated_at: Date }[]>`SELECT key, value, updated_at FROM kv ORDER BY key`,
    sql<{ titles: number; devices: number; follows: number; push: number; premium: number; reviews: number }[]>`SELECT
      (SELECT count(*)::int FROM titles) AS titles, (SELECT count(*)::int FROM devices) AS devices,
      (SELECT count(*)::int FROM follows) AS follows, (SELECT count(*)::int FROM push_subscriptions) AS push,
      (SELECT count(*)::int FROM devices WHERE premium_until > now()) AS premium, (SELECT count(*)::int FROM reviews) AS reviews`,
  ]);
  const c = counts[0];
  const btn = (id: number, action: string, label: string) => (
    <form method="post" action="/api/admin/review"><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={action} />
      <button className="btn soft">{label}</button></form>
  );

  return (
    <div className="bento">
      <div className="tile w4"><h1 style={{ fontSize: 26 }}>{SITE}: administrácia</h1></div>
      {Object.entries({ Tituly: c.titles, Zariadenia: c.devices, Sledovania: c.follows, "Push odbery": c.push, Prémium: c.premium, Recenzie: c.reviews }).map(([k, v]) => (
        <div key={k} className="tile stat"><span className="lbl">{k}</span><span className="rv">{v}</span></div>
      ))}
      <div className="tile w2">
        <div className="lbl"><span>Stav robota</span></div>
        {state.map((s) => <div key={s.key} className="ep"><span className="mono">{s.key}</span><span className="mono" style={{ overflowWrap: "anywhere" }}>{JSON.stringify(s.value)}</span><span className="mono">{s.updated_at.toISOString().slice(0, 16).replace("T", " ")}</span></div>)}
      </div>
      <div className="tile w4">
        <div className="lbl"><span>Recenzie na kontrolu a nové</span><span>{queue.length}</span></div>
        {queue.length === 0 && <p className="muted">Nič na kontrolu.</p>}
        {queue.map((r) => (
          <div key={r.id} className="review">
            <div className="rhead"><b>{r.name}</b><span className="chipday">{r.status}</span><span className="chipday">nahlásené {r.reports}×</span>
              <small className="muted">{r.lang} · {r.nickname ?? "anonym"} · {r.created_at.toISOString().slice(0, 16).replace("T", " ")}</small></div>
            <p>{r.body}</p>
            <div className="frow">{btn(r.id, "approve", "Schváliť")}{btn(r.id, "hide", "Skryť")}{btn(r.id, "delete", "Zmazať")}{btn(r.id, "ban", "Zmazať všetky od autora")}</div>
          </div>
        ))}
      </div>
      <div className="tile w4" id="promos">
        <div className="lbl"><span>Odporúčané boxy (predaná reklama na domovskej stránke)</span><span>{promos.length}</span></div>
        <p className="muted">Box sa zobrazí na domovskej stránke s označením „Reklama“. Prémioví užívatelia ho nevidia. Ak je aktívnych viac, striedajú sa náhodne.</p>
        {promos.map((p) => (
          <div key={p.id} className="ep" style={{ gridTemplateColumns: "1fr auto auto" }}>
            <span><b>{p.label}</b> · {p.headline}<br /><small className="muted">{p.starts_at} až {p.ends_at} · {p.langs.length ? p.langs.join(", ") : "všetky jazyky"} · {p.url}</small></span>
            <span className="mono">{p.impressions} zobrazení · {p.clicks} klikov{p.impressions ? ` (${((p.clicks / p.impressions) * 100).toFixed(1)} %)` : ""}</span>
            <span className="frow">
              <form method="post" action="/api/admin/promo"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="action" value="toggle" /><button className="btn soft">{p.active ? "Vypnúť" : "Zapnúť"}</button></form>
              <form method="post" action="/api/admin/promo"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="action" value="delete" /><button className="btn soft">Zmazať</button></form>
            </span>
          </div>
        ))}
        <form method="post" action="/api/admin/promo" className="promoform">
          <input type="hidden" name="action" value="create" />
          <input className="inp" name="label" placeholder="Interný názov (napr. Netflix december)" />
          <input className="inp" name="headline" placeholder="Nadpis *" required maxLength={120} />
          <input className="inp" name="body" placeholder="Krátky text" maxLength={240} />
          <input className="inp" name="url" placeholder="Cieľová adresa https://… *" required />
          <input className="inp" name="image" placeholder="Obrázok https://… (nepovinné)" />
          <div className="frow">
            <select className="inp" name="kind" style={{ width: "auto" }}><option value="tv">Seriál</option><option value="movie">Film</option></select>
            <input className="inp" name="tmdb" placeholder="TMDB id titulu (plagát, nepovinné)" style={{ flex: 1 }} />
          </div>
          <div className="frow">
            <input className="inp" name="langs" placeholder="Jazyky, napr. sk,cs (prázdne = všetky)" style={{ flex: 1 }} />
            <input className="inp" type="date" name="starts" style={{ width: "auto" }} />
            <input className="inp" type="date" name="ends" style={{ width: "auto" }} />
          </div>
          <button className="btn" style={{ alignSelf: "flex-start" }}>Pridať box</button>
        </form>
      </div>
      <div className="tile w2">
        <div className="lbl"><span>Kliky na platformy (30 dní)</span></div>
        {clicksByProv.length ? clicksByProv.map((r) => <div key={r.name + r.region} className="ep"><span className="mono">{r.region}</span><span>{r.name}</span><span className="mono">{r.clicks}</span></div>)
          : <p className="muted">Zatiaľ žiadne kliky.</p>}
      </div>
      <div className="tile w2">
        <div className="lbl"><span>Najklikanejšie tituly (30 dní)</span></div>
        {topTitles.length ? topTitles.map((r, i) => <div key={r.name} className="ep"><span className="mono">{i + 1}.</span><span>{r.name}</span><span className="mono">{r.clicks}</span></div>)
          : <p className="muted">Zatiaľ žiadne kliky.</p>}
      </div>
    </div>
  );
}
