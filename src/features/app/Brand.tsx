"use client";

import Link from "next/link";
import Isotype from "@/ui/Isotype";
import { useSite } from "@/features/app/SiteProvider";

/**
 * The brand card in the top-left of the bar.
 *
 * Reads the RESOLVED configuration, not the compiled preset: the name and the host come
 * from the emergency row, which is what lets a deployment be renamed without a rebuild.
 * It used to read `BRAND` from `@/config`, so a name edited in the registry never showed.
 *
 * Logo resolution, in order: an image declared by the emergency (a file dropped in
 * `public/`), then the isotype from the brand manual. There is no empty-box state: the
 * mark is drawn, not fetched.
 *
 * The text label is desktop-only by design (`.bcol`): on a phone this row also carries
 * the language switcher and the staff button, and the name is the first thing that can
 * go without costing anyone anything.
 */
export default function Brand() {
  const site = useSite();

  return (
    <Link href="/" className="brand" aria-label={site.brand.name}>
      <span className="logo">
        {site.brand.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a config-provided path, not a known-size asset
          <img src={site.brand.logo} alt="" width={30} height={30} />
        ) : (
          <Isotype size={30} />
        )}
      </span>
      <span className="bcol">
        <span className="bname">{site.brand.name}</span>
        <span className="btag">{site.country.host}</span>
      </span>
    </Link>
  );
}
