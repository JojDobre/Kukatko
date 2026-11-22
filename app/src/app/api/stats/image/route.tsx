import { ImageResponse } from "next/og";
import { cookies } from "next/headers";
import { deviceId } from "@/lib/device";
import { stats } from "@/lib/features";
import { dict, fmt } from "@/lib/i18n";
import { DEFAULT_LANG, isLang } from "@/lib/locales";
import { img } from "@/lib/format";
import { ogFonts } from "@/lib/og";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Obrázok „Môj rok“ na zdieľanie (formát na príbeh 1080 × 1350). */
export async function GET(req: Request) {
  const dev = await deviceId();
  if (!dev) return new Response("Bez zariadenia", { status: 400 });
  const l = (await cookies()).get("lang")?.value;
  const lang = isLang(l) ? l : DEFAULT_LANG;
  const d = dict(lang).stats;
  const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
  const s = await stats(dev, lang, year);
  const big = (n: number | string, label: string) => (
    <div style={{ display: "flex", flexDirection: "column", background: "#1F1F27", borderRadius: 32, padding: "28px 32px", flex: 1 }}>
      <div style={{ display: "flex", fontSize: 76, fontWeight: 800, letterSpacing: -3 }}>{n}</div>
      <div style={{ display: "flex", fontSize: 28, color: "#A9A9B8", fontWeight: 500 }}>{label}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0C0C10", color: "#F2F2F6", fontFamily: "Onest", padding: 64, gap: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 800 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: "#FF6B33", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: "#140803" }} />
          </div>
          {SITE}
        </div>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, lineHeight: 1, letterSpacing: -4, marginTop: 24 }}>{fmt(d.recap, { year })}</div>
        <div style={{ display: "flex", gap: 20 }}>{big(s.hours, d.hours)}{big(s.episodes, d.episodes)}</div>
        <div style={{ display: "flex", gap: 20 }}>{big(s.movies, d.movies)}{big(s.rated, d.rated)}</div>
        {s.genres.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 28, color: "#A9A9B8", textTransform: "uppercase", letterSpacing: 3 }}>{d.topGenres}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {s.genres.map(([g]) => <div key={g} style={{ display: "flex", fontSize: 32, fontWeight: 800, padding: "12px 22px", borderRadius: 999, background: "#FF6B33", color: "#140803" }}>{g}</div>)}
            </div>
          </div>
        )}
        {s.top.length > 0 && (
          <div style={{ display: "flex", gap: 16, marginTop: "auto" }}>
            {s.top.slice(0, 4).map((t) => t.poster_path
              ? <img key={t.id} src={img(t.poster_path, "w342")!} width={220} height={330} style={{ borderRadius: 22, objectFit: "cover" }} />
              : <div key={t.id} style={{ width: 220, height: 330, borderRadius: 22, background: "#1F1F27", display: "flex", alignItems: "flex-end", padding: 16, fontSize: 26, fontWeight: 800 }}>{t.name}</div>)}
          </div>
        )}
      </div>
    ),
    { width: 1080, height: 1350, fonts: await ogFonts(), headers: { "Cache-Control": "private, no-store" } },
  );
}
