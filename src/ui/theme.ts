import { BRAND } from "@/config";
import type { BrandConfig } from "@/config/types";

/**
 * The brand config, rendered as CSS custom properties.
 *
 * The token NAMES are the ones the HelpMap design system already used (`--ink`, `--mut`,
 * `--line`, `--soft`, `--accent`…), so the stylesheet ported from the original app works
 * unchanged and anyone who knows that codebase can read this one.
 *
 * Injected once in `app/layout.tsx`. No stylesheet may hardcode a colour: that is what
 * makes re-skinning a clone a config edit rather than a sweep through the CSS.
 *
 * Takes the brand rather than reading the compiled one so the tokens follow the
 * configuration actually resolved for this request — a colour edited in an emergency row
 * has to reach the page, not just the bundle. Defaults to the preset, so every existing
 * call site keeps working unchanged.
 */
export function themeCss(brand: BrandConfig = BRAND): string {
  const c = brand.colors;
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
--r-sm:${brand.radius.sm}px;
--r-md:${brand.radius.md}px;
--r-lg:${brand.radius.lg}px;
--font-sans:${brand.font.sans};
--font-display:${brand.font.display};
}`;
}
