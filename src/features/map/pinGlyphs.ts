import { enabledTypes, typeStyle } from "@/config";
import type { LocationType } from "@/domain/types";

// Leaflet markers are built with `divIcon`, which takes an HTML string, so a pin glyph
// cannot be a React component. These are the same shapes as `src/ui/icons.tsx`, kept as
// raw path data.
//
// Rendering React to a string in the browser would mean pulling `react-dom/server` into
// the client bundle for a 12px drawing; on the connections this app is built for that is
// a bad trade.

// Inner markup, not bare `d` strings: the hospital is a rect and the initiative glyph is
// a circle plus arcs, and neither collapses into one path. Shapes are identical to their
// JSX twins in `src/ui/icons.tsx` — if you change one, change both.
const GLYPHS: Record<string, string> = {
  shelter: '<path d="M4 11.5 12 4l8 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
  box: '<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
  meal: '<path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M6 12v9"/><path d="M18 3c-1.7 0-3 2-3 5s1 4 3 4v9"/>',
  spark: '<path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 11 10.1 9 12 3.5Z"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20v-1.2A4.8 4.8 0 0 1 7.3 14h3.4a4.8 4.8 0 0 1 4.8 4.8V20"/>' +
    '<path d="M16.4 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M18.2 14.2a4.2 4.2 0 0 1 3.3 4.1V20"/>',
  hospital: '<rect x="3.5" y="4" width="17" height="17" rx="2"/><path d="M12 8.5v7M8.5 12h7"/>',
  morgue: '<path d="M6 21V10.5a6 6 0 0 1 12 0V21"/><path d="M4.5 21h15"/>',
  heart: '<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/>',
};

/**
 * SVG markup for a pin glyph.
 *
 * Stroke is 2.6 rather than the 1.8 the JSX icons use: these paint at 12–13px on a
 * coloured pin, and a hairline that reads fine at 18px on white disappears there.
 */
export function glyphSvg(name: string, size = 15, extra = ""): string {
  const inner = GLYPHS[name] ?? GLYPHS.pin;
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>` +
    `${inner}</svg>`
  );
}

/**
 * Where each type's cluster pin sits relative to the cluster's real point.
 *
 * Clusters are grouped per TYPE, so several land on the same coordinate and would stack
 * into one unreadable blob. Fanning them along a shallow arc keeps every type — and its
 * count — visible. Computed from the enabled types so a country that turns one off gets
 * a spread that is still symmetric, instead of a gap where the morgue used to be.
 */
function fanOffsets(): Record<string, [number, number]> {
  const types = enabledTypes();
  const n = types.length;
  const out: Record<string, [number, number]> = {};
  types.forEach((type, i) => {
    const x = n === 1 ? 0 : ((i - (n - 1) / 2) / ((n - 1) / 2)) * 50;
    const y = -18 + 14 * (x / 50) ** 2;
    out[type] = [Math.round(x), Math.round(y)];
  });
  return out;
}

let FAN: Record<string, [number, number]> | null = null;

/**
 * A cluster badge: a location pin tinted with the type colour, the type glyph in white
 * inside its head, and a small count bubble.
 *
 * The glyph and the count are nested INSIDE the pin's own `<svg>` — one paint — so a
 * neighbouring fanned-out pin can never paint over them.
 */
export function clusterPinHtml(type: LocationType, count: number): string {
  FAN ??= fanOffsets();
  const style = typeStyle(type);
  const [dx, dy] = FAN[type] ?? [0, -18];

  const icon = glyphSvg(style.icon, 13, ' x="5.5" y="5" style="color:#fff"');
  const label = count > 99 ? "99+" : String(count);
  const badgeR = label.length > 2 ? 9 : label.length > 1 ? 8 : 6.5;
  const badgeFont = label.length > 2 ? 6.5 : 7.5;

  return (
    `<div class="mkcl" style="color:${style.color};transform:translate(${dx}px,${dy}px)">` +
    `<svg class="mkcl-pin" viewBox="0 0 24 34" aria-hidden="true">` +
    `<path d="M12 0C5.37 0 0 5.37 0 12c0 8.5 12 22 12 22s12-13.5 12-22C24 5.37 18.63 0 12 0z" ` +
    `fill="currentColor" stroke="#fff" stroke-width="1.7"/>` +
    icon +
    `<circle class="mkcl-badge-bg" cx="20" cy="4" r="${badgeR}"/>` +
    `<text class="mkcl-badge-text" x="20" y="4.5" font-size="${badgeFont}">${label}</text>` +
    `</svg></div>`
  );
}
