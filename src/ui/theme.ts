import { BRAND } from "@/config";

/**
 * The brand config, rendered as CSS custom properties.
 *
 * The token NAMES are the ones the HelpMap design system already used (`--ink`, `--mut`,
 * `--line`, `--soft`, `--accent`…), so the stylesheet ported from the original app works
 * unchanged and anyone who knows that codebase can read this one.
 *
 * Injected once in `app/layout.tsx`. No stylesheet may hardcode a colour: that is what
 * makes re-skinning a clone a config edit rather than a sweep through the CSS.
 */
export function themeCss(): string {
  const c = BRAND.colors;
  return `:root{
--ink:${c.ink};
--mut:${c.muted};
--line:${c.line};
--soft:${c.soft};
--soft2:${c.soft2};
--accent:${c.accent};
--brand:${c.brand};
--ok:${c.ok};
--adm:${c.info};
--dec:${c.neutral};
--danger:${c.danger};
--r-sm:${BRAND.radius.sm}px;
--r-md:${BRAND.radius.md}px;
--r-lg:${BRAND.radius.lg}px;
--font-sans:${BRAND.font.sans};
--font-display:${BRAND.font.display};
}`;
}
