import Link from "next/link";
import { dict, plural } from "@/lib/i18n";
import { img } from "@/lib/format";
import { platformStyle } from "@/lib/platforms";
import { href, type Lang } from "@/lib/locales";
import { Arrow } from "./icons";

type P = { id: number; name: string; slug: string; logo_path: string | null; count: number };

/** Pás platforiem s logami a počtom titulov (domovská stránka). */
export default function PlatformStrip({ lang, provs }: { lang: Lang; provs: P[] }) {
  const d = dict(lang);
  if (!provs.length) return null;
  return (
    <section className="tile w4 pstrip">
      <div className="cathead">
        <div><h2>{d.more.platforms}</h2><p className="muted small">{d.more.platformsSub}</p></div>
        <Link className="btn soft" href={href(lang, "/platforms")}>{d.platform.all} <Arrow /></Link>
      </div>
      <div className="prow">
        {provs.slice(0, 12).map((p) => {
          const st = platformStyle(p.name);
          return (
            <Link key={p.id} href={href(lang, `/platform/${p.slug}`)} className="pcard">
              {p.logo_path ? <img src={img(p.logo_path, "w92")!} alt="" loading="lazy" /> : <span className="plogo-f" style={{ background: st.color }}>{st.short}</span>}
              <b>{p.name}</b>
              <small className="muted">{plural(d.common.titles, p.count, lang)}</small>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
