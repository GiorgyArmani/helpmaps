import type { ReactNode } from "react";
import type { Lang } from "@/i18n/types";

// Flat flag icons for the language switcher — ported from the original app, including
// the reason they are SVG and not emoji: Windows renders 🇪🇸/🇧🇷 as two plain letters on
// many builds instead of a flag glyph, so the switcher looked broken for a good share of
// desktop readers. 24x16 viewBox (3:2).

export const FLAG_ICON: Record<Lang, ReactNode> = {
  es: (
    <svg viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#AA151B" />
      <rect y="4" width="24" height="8" fill="#F1BF00" />
    </svg>
  ),
  en: (
    <svg viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#B22234" />
      {[0, 2, 4, 6, 8, 10].map((y) => (
        <rect key={y} y={y + 1.23} width="24" height="1.23" fill="#fff" />
      ))}
      <rect width="10.5" height="8.6" fill="#3C3B6E" />
    </svg>
  ),
  pt: (
    <svg viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#009739" />
      <polygon points="12,2 22,8 12,14 2,8" fill="#FEDD00" />
      <circle cx="12" cy="8" r="3.4" fill="#012169" />
    </svg>
  ),
};

/** Language names as they are written in that language, not translated. */
export const LANG_NAME: Record<Lang, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
};
