import type { Center } from "@/domain/types";

// How a digital initiative's coverage is WORDED — one place, used by the card, the detail
// view, the share text and the server-rendered pages. Takes the label and translate
// functions as arguments so it runs on the server (config-bound `regionLabel`,
// `translator`) and in the browser (`useSiteHelpers`, `useI18n`) without two copies.

type Translate = (key: "digital.national" | "digital.more", vars?: Record<string, string | number>) => string;

/** Display names of the served regions, in the order they were declared. */
export function coverageNames(
  center: Pick<Center, "coverage_regions">,
  regionLabel: (code: string) => string,
): string[] {
  return center.coverage_regions.map(regionLabel);
}

/**
 * "Chocó, Antioquia, Valle del Cauca +2 más", or "Todo el país" for an empty list.
 * Capped so a card stays one line; the detail view lists them all as tags.
 */
export function coverageLabel(
  center: Pick<Center, "coverage_regions">,
  regionLabel: (code: string) => string,
  t: Translate,
  max = 3,
): string {
  const names = coverageNames(center, regionLabel);
  if (names.length === 0) return t("digital.national");
  const shown = names.slice(0, max).join(", ");
  const rest = names.length - max;
  return rest > 0 ? `${shown} ${t("digital.more", { n: rest })}` : shown;
}

/** The public Instagram URL for a stored handle (kept without the `@`). */
export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}
