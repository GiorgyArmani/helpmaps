"use client";

import Link from "next/link";
import { BRAND, COUNTRY } from "@/config";

/**
 * The floating brand card in the top-left corner.
 *
 * Logo resolution, in order: an image from `config/brand.ts` (a file you drop in
 * `public/`), then the configured emoji, then the country code. A clone that has not
 * chosen a logo yet still gets a filled mark rather than an empty box.
 *
 * The text label is desktop-only by design (`.bcol`): on a phone this row also carries
 * the language switcher and the staff button, and the name is the first thing that can
 * go without costing anyone anything.
 */
export default function Brand() {
  return (
    <Link href="/" className="brand" aria-label={BRAND.name}>
      <span className="logo">
        {BRAND.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a config-provided path, not a known-size asset
          <img src={BRAND.logo} alt="" width={30} height={30} />
        ) : (
          <span aria-hidden>{BRAND.emoji || COUNTRY.code}</span>
        )}
      </span>
      <span className="bcol">
        <span className="bname">{BRAND.name}</span>
        <span className="btag">{COUNTRY.host}</span>
      </span>
    </Link>
  );
}
