import { intensityBand, type Quake, type QuakeAlert } from "@/domain/hazard";
import { cleanUrl } from "@/lib/sanitize";
import type { Translate } from "@/i18n";
import type { DictKey } from "@/i18n";

/**
 * Presentation for the seismic layer: marker geometry and popup markup.
 *
 * Split out of `MapCanvas` because Leaflet wants HTML strings, not React, and mixing
 * string-built markup into the component made it very easy to lose track of which parts
 * of it came from a third party. Everything interpolated below is either a number we
 * produced or is passed through `esc`.
 */

/**
 * PAGER alert colours, USGS's own. `place` and friends are strings from an external
 * service; these are not — they are picked from a closed set here so nothing from the
 * wire ever reaches a `style` attribute.
 */
export const ALERT_COLOR: Record<QuakeAlert, string> = {
  green: "#00b04f",
  yellow: "#f2d600",
  orange: "#ff8c00",
  red: "#e0201b",
};

/** Epicentres with no PAGER run at all — most of them. Neutral, not "safe". */
const NO_ALERT_COLOR = "#6b7280";

export function alertColor(quake: Quake): string {
  return quake.alert ? ALERT_COLOR[quake.alert] : NO_ALERT_COLOR;
}

/**
 * Marker radius in pixels. Magnitude is logarithmic, so the drawn area is scaled by the
 * released energy rather than by the number: an M7 is not "1.4× an M5", and a linear
 * radius would show it that way.
 */
export function quakeRadius(magnitude: number): number {
  return Math.max(5, Math.min(26, 2.6 * Math.max(magnitude - 2.5, 0.5) ** 1.25));
}

/** HTML-escape. Everything from USGS goes through here before it becomes markup. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string): string {
  return `<span class="qk-row"><span class="qk-k">${esc(label)}</span><span class="qk-v">${esc(value)}</span></span>`;
}

/**
 * The popup for one epicentre.
 *
 * Deliberately NOT a casualty readout. The feed carries PAGER's fatality and loss
 * estimates and this popup does not show them: they are wide probability ranges that read
 * as counts, and a screenshot of "1,000 dead" from an automatic model spreading during
 * the first hours of an emergency does real harm. The impact level and a link to USGS's
 * own page carry the same warning without inviting that.
 */
export function quakePopupHtml(quake: Quake, t: Translate, locale: string): string {
  const parts: string[] = [];

  const magnitude = `M ${quake.magnitude.toFixed(1)}${quake.magType ? ` (${quake.magType})` : ""}`;
  parts.push(`<b class="qk-title">${esc(magnitude)}</b>`);

  if (quake.place) parts.push(`<span class="qk-place">${esc(quake.place)}</span>`);

  parts.push(
    `<time class="qk-time">${esc(new Date(quake.time).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }))}</time>`,
  );

  const rows: string[] = [];
  if (quake.depthKm !== null) {
    rows.push(row(t("quake.depth"), t("quake.km", { n: Math.round(quake.depthKm) })));
  }
  if (quake.maxMmi !== null) {
    const band = intensityBand(quake.maxMmi);
    rows.push(
      row(
        t("quake.maxIntensity"),
        `${band.roman} · ${t(`mmi.${band.degree}.shaking` as DictKey)}`,
      ),
    );
  }
  if (quake.alert) {
    rows.push(row(t("quake.alert"), t(`quake.alert.${quake.alert}` as DictKey)));
  }
  if (quake.feltReports !== null && quake.feltReports > 0) {
    rows.push(
      row(
        "",
        quake.feltReports === 1
          ? t("quake.feltOne")
          : t("quake.felt", { n: quake.feltReports }),
      ),
    );
  }
  if (rows.length > 0) parts.push(`<span class="qk-rows">${rows.join("")}</span>`);

  if (quake.tsunami) parts.push(`<span class="qk-tsunami">${esc(t("quake.tsunami"))}</span>`);

  // `cleanUrl` guarantees http/https, so this can never become a `javascript:` href even
  // if the feed were compromised.
  const href = cleanUrl(quake.url);
  if (href) {
    parts.push(
      `<a class="qk-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(t("quake.eventPage"))}</a>`,
    );
  }

  return `<div class="qk">${parts.join("")}</div>`;
}
