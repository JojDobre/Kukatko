import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

let fonts: Promise<{ name: string; data: Buffer; weight: 500 | 800; style: "normal" }[]> | null = null;
/** Písmo Onest so slovenskou diakritikou (latin + latin-ext, dve hrúbky). */
export function ogFonts() {
  fonts ??= Promise.all(
    ([500, 800] as const).flatMap((w) => ["latin", "latin-ext"].map(async (s) => ({
      name: "Onest", weight: w, style: "normal" as const,
      data: await readFile(join(process.cwd(), "assets/fonts", `onest-${s}-${w}-normal.woff`)),
    }))),
  );
  return fonts;
}

const ACCENT = "#FF6B33";

export async function ogImage(o: { site: string; kind: string; title: string; meta: string; score: number | null; poster: string | null; providers: string[]; label?: string }) {
  const tone = o.score == null ? "#8E8E9E" : o.score >= 80 ? "#3DD68C" : o.score >= 65 ? "#F2BC4B" : "#FF6A55";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0C0C10", color: "#F2F2F6", fontFamily: "Onest", padding: 48, gap: 48 }}>
        {o.poster
          ? <img src={o.poster} width={356} height={534} style={{ borderRadius: 28, objectFit: "cover" }} />
          : <div style={{ width: 356, height: 534, borderRadius: 28, background: "linear-gradient(150deg,#FF6B33,#5B2BE0)", display: "flex" }} />}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 800 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: "#140803" }} />
            </div>
            {o.site}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#A9A9B8", textTransform: "uppercase", letterSpacing: 3 }}>{o.label ?? o.kind}</div>
            <div style={{ display: "flex", fontSize: o.title.length > 28 ? 60 : 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{o.title}</div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: "#C9C9D4" }}>{o.meta}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {o.score != null && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 120, height: 120, borderRadius: 60, border: `10px solid ${tone}`, fontSize: 44, fontWeight: 800 }}>{o.score}</div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, flex: 1 }}>
              {o.providers.slice(0, 4).map((p) => (
                <div key={p} style={{ display: "flex", fontSize: 26, fontWeight: 800, padding: "10px 18px", borderRadius: 999, background: "#1F1F27" }}>{p}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
