import { img } from "@/lib/format";
import type { Promo } from "@/lib/promo";

/** Odporúčaný box predaný inzerentovi. Vždy viditeľne označený ako reklama. */
export default function PromoTile({ p, label }: { p: Promo; label: string }) {
  const pic = p.image_url ?? img(p.poster_path, "w342");
  return (
    <a className="tile w4 promo" href={`/out/promo/${p.id}`} target="_blank" rel="sponsored noopener">
      {pic && <img src={pic} alt="" loading="lazy" />}
      <div>
        <span className="adlabel">{label}</span>
        <h2>{p.headline}</h2>
        {p.body && <p className="muted">{p.body}</p>}
      </div>
    </a>
  );
}
