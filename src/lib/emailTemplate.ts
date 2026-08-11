import { BRAND, COUNTRY, siteUrl } from "@/config";

/**
 * The HTML frame every outbound email shares, built from `config/brand.ts` so a clone
 * inherits its own name, colours, logo and contact address without touching this file.
 *
 * Email is not the web, and this is the part people re-learn the hard way:
 *
 *   • **Tables, not flex.** Outlook renders through Word and ignores flexbox, grid and
 *     `display:inline-block` alignment. The header lockup is a table because that is the
 *     only layout every client agrees on.
 *   • **Inline styles only.** Gmail strips `<style>` blocks on several account types, so
 *     a stylesheet is a design that disappears for a slice of the recipients.
 *   • **The wordmark is TEXT next to the logo.** Remote images are blocked by default in
 *     many clients; if the brand only exists inside the `<img>`, the email arrives blank
 *     at the top.
 *   • **Modern colour functions do not resolve.** `oklch()` and `color-mix()` are fine on
 *     the map and unknown to mail clients, which fall back to black or transparent. The
 *     palette below narrows the brand colours to hex/rgb and substitutes a safe default
 *     for anything else — that is why a clone can put `oklch()` in its config and still
 *     get a readable email.
 *
 * The logo is referenced by absolute URL rather than attached inline: an embedded image
 * raises the spam score, and deliverability is already the weakest link in this chain.
 */

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /^rgba?\([\d\s.,%]+\)$/i;

function mailColor(value: string | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  return HEX.test(v) || RGB.test(v) ? v : fallback;
}

const C = {
  page: "#f2f3f5",
  card: "#ffffff",
  ink: mailColor(BRAND.colors.ink, "#16191f"),
  muted: mailColor(BRAND.colors.muted, "#7b818c"),
  line: mailColor(BRAND.colors.line, "#ebecef"),
  soft: mailColor(BRAND.colors.soft, "#f7f8f9"),
  accent: mailColor(BRAND.colors.accent, "#15181d"),
  brand: mailColor(BRAND.colors.brand, "#1d4ed8"),
  onAccent: "#ffffff",
  onAccentMuted: "#9aa3b4",
};

// A radius scale a clone could set to anything, clamped to what still reads as an email
// card rather than a pill, and always a plain px number.
function radius(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(24, Math.round(value))) : fallback;
}

const R = {
  sm: radius(BRAND.radius.sm, 9),
  md: radius(BRAND.radius.md, 12),
  lg: radius(BRAND.radius.lg, 16),
};

// Web fonts do not exist here. The clone's stack is kept in front (it is usually a system
// stack anyway) with the classic email-safe families behind it.
const FONT = `${BRAND.font.sans}, Arial, Helvetica, sans-serif`;

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

// ---------------------------------------------------------------------------
// Blocks. Each escapes its own input, so a template composes them with plain text.
// ---------------------------------------------------------------------------

export function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:700;color:${C.ink}">${escapeHtml(text)}</h1>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${C.ink}">${escapeHtml(text)}</p>`;
}

/** Secondary paragraph: the same words, one step quieter. */
export function note(text: string): string {
  return `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${C.muted}">${escapeHtml(text)}</p>`;
}

/** `Label: value` line. Returns "" for an empty value so a template can just list them. */
export function field(label: string, value: string | number | null | undefined): string {
  const v = value == null ? "" : String(value).trim();
  if (!v) return "";
  return `<p style="margin:0 0 6px;font-size:14px;line-height:1.5;color:${C.ink}"><span style="color:${C.muted}">${escapeHtml(label)}:</span> <strong>${escapeHtml(v)}</strong></p>`;
}

/** Free text from a person, kept on its own surface and preserving line breaks. */
export function quote(text: string): string {
  return `<div style="margin:12px 0;padding:14px 16px;background:${C.soft};border:1px solid ${C.line};border-radius:${R.md}px;font-size:14px;line-height:1.6;color:${C.ink};white-space:pre-wrap">${escapeHtml(text)}</div>`;
}

export function panel(innerHtml: string): string {
  return `<div style="margin:16px 0;padding:14px 16px;background:${C.soft};border:1px solid ${C.line};border-radius:${R.md}px">${innerHtml}</div>`;
}

/** A value meant to be read character by character (a temporary password). */
export function mono(label: string, value: string): string {
  return `<div style="font-size:12px;color:${C.muted};margin-bottom:2px">${escapeHtml(label)}</div>
    <div style="font-size:15px;font-weight:700;font-family:Menlo,Consolas,monospace;color:${C.ink};word-break:break-all">${escapeHtml(value)}</div>`;
}

export function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${C.accent};color:${C.onAccent};text-decoration:none;padding:12px 20px;border-radius:${R.sm}px;font-weight:700;font-size:14px;line-height:1">${escapeHtml(label)}</a>`;
}

/** A destination with a reason to click it. Used for the manuals in the welcome email. */
export function linkCard(href: string, title: string, desc: string): string {
  return `<a href="${escapeHtml(href)}" style="display:block;text-decoration:none;border:1px solid ${C.line};border-radius:${R.md}px;padding:12px 14px;margin-bottom:8px">
      <span style="display:block;font-size:14px;font-weight:700;color:${C.ink}">${escapeHtml(title)}</span>
      <span style="display:block;font-size:13px;line-height:1.5;color:${C.muted};margin-top:2px">${escapeHtml(desc)}</span>
    </a>`;
}

export function sectionLabel(text: string): string {
  return `<div style="font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:${C.muted};margin:20px 0 10px">${escapeHtml(text)}</div>`;
}

export function divider(): string {
  return `<div style="border-top:1px solid ${C.line};margin:16px 0"></div>`;
}

// ---------------------------------------------------------------------------
// The frame
// ---------------------------------------------------------------------------

function logoCell(site: string): string {
  if (BRAND.logo) {
    return `<td style="padding-right:12px" valign="middle">
        <a href="${site}" style="text-decoration:none">
          <img src="${site}${escapeHtml(BRAND.logo)}" width="40" height="40" alt="${escapeHtml(BRAND.name)}"
            style="display:block;width:40px;height:40px;border-radius:${R.sm}px;border:0" />
        </a>
      </td>`;
  }
  // No logo file: the country's initial (or the configured emoji) on the brand colour —
  // the header still reads as something rather than starting with a bare word.
  const glyph = BRAND.emoji || COUNTRY.code.slice(0, 1).toUpperCase();
  return `<td style="padding-right:12px" valign="middle">
      <div style="width:40px;height:40px;border-radius:${R.sm}px;background:${C.brand};color:#ffffff;text-align:center;font-size:18px;font-weight:700;line-height:40px">${escapeHtml(glyph)}</div>
    </td>`;
}

export interface ShellOptions {
  /** The line clients show next to the subject in the inbox list. */
  preheader?: string;
  /** Composed from the blocks above. */
  body: string;
  /** Second footer line. Defaults to the brand tagline. */
  footer?: string;
  /** Overrides the canonical origin (previews, tests). */
  site?: string;
}

export function emailShell({ preheader, body, footer, site: origin }: ShellOptions): string {
  const site = (origin ?? siteUrl()).replace(/\/+$/, "");
  const contact = BRAND.contact.email;
  const footerNote = escapeHtml(footer ?? BRAND.tagline);

  return `<div style="background:${C.page};padding:24px 12px;font-family:${FONT}">
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>`
      : ""
  }
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:${C.card};border:1px solid ${C.line};border-radius:${R.lg}px;overflow:hidden">
    <tr>
      <td style="background:${C.accent};padding:16px 20px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${logoCell(site)}
            <td valign="middle">
              <a href="${site}" style="text-decoration:none">
                <span style="display:block;font-size:16px;font-weight:700;letter-spacing:.2px;color:${C.onAccent}">${escapeHtml(BRAND.name)}</span>
                <span style="display:block;font-size:12px;color:${C.onAccentMuted};margin-top:2px">${escapeHtml(BRAND.tagline)}</span>
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 24px 10px;color:${C.ink}">${body}</td>
    </tr>
    <tr>
      <td style="padding:16px 24px 22px;border-top:1px solid ${C.line}">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${C.muted}">
          <a href="${site}" style="color:${C.brand};text-decoration:none">${escapeHtml(COUNTRY.host)}</a>${
            contact
              ? `&nbsp;·&nbsp;<a href="mailto:${escapeHtml(contact)}" style="color:${C.brand};text-decoration:none">${escapeHtml(contact)}</a>`
              : ""
          }
          <br />${footerNote}
        </p>
      </td>
    </tr>
  </table>
</div>`;
}
