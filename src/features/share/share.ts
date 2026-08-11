import type { Center } from "@/domain/types";
import { absoluteUrl } from "@/config";

// Reach depends on people re-sharing a single point into WhatsApp, Telegram and
// Instagram. Every share therefore carries: what the place is, what it needs, and a link
// that opens the full card with directions.

export function centerUrl(id: string): string {
  return absoluteUrl(`/c/${id}`);
}

export interface ShareTexts {
  /** Localised type label, e.g. "Refugio". */
  typeLabel: string;
  /** Region or municipality, already resolved to a display name. */
  place: string;
  /** "{name} necesita: {needs}" */
  needTemplate: string;
  /** "{name} — {type} en {place}" */
  pointTemplate: string;
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

/** The message body. Needs come first when there are any: that is the actionable part. */
export function shareText(center: Center, texts: ShareTexts): string {
  const needs = center.info?.needs?.trim();
  const head = needs
    ? fill(texts.needTemplate, { name: center.name, needs })
    : fill(texts.pointTemplate, {
        name: center.name,
        type: texts.typeLabel,
        place: texts.place || "",
      });
  return `${head}\n${centerUrl(center.id)}`;
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telegramUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/**
 * Uses the OS share sheet when the browser has one (every modern phone), which reaches
 * Instagram and any other app the person has — none of which expose a share URL.
 * Returns false when it is unavailable so the caller can fall back to WhatsApp/copy.
 */
export async function nativeShare(title: string, text: string, url: string): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    await navigator.share({ title, text, url });
    return true;
  } catch {
    // Cancelling the sheet lands here too; treating it as "handled" avoids popping a
    // second share UI at someone who just backed out of the first.
    return true;
  }
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** tel:/wa.me links, tolerant of numbers stored with spaces, dashes or a leading +. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function whatsappHref(number: string, text?: string): string {
  const digits = number.replace(/\D/g, "");
  return text
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${digits}`;
}

// ---------------------------------------------------------------------------
// Social image
// ---------------------------------------------------------------------------

/** The canvases `/c/<id>/story?f=` renders. Adding one here + in OG_FORMAT is enough. */
export type ShareFormat = "story" | "post" | "square";

export const IG_FORMATS: {
  fmt: ShareFormat;
  /** Dictionary key for the label. */
  key: "share.igStory" | "share.igPost" | "share.igSquare";
  /** Preview rectangle drawn at the real ratio, so the choice reads without reading. */
  w: number;
  h: number;
}[] = [
  { fmt: "story", key: "share.igStory", w: 18, h: 32 },
  { fmt: "post", key: "share.igPost", w: 26, h: 32 },
  { fmt: "square", key: "share.igSquare", w: 30, h: 30 },
];

export type ImageShareResult = "shared" | "downloaded" | "error";

/**
 * Fetch the server-generated PNG and hand it to the OS share sheet as a FILE, which is
 * what reaches Instagram — it has no share-URL intent, so the image IS the share.
 *
 * The sheet is used on touch devices only. On a desktop the OS share dialog is not what
 * anyone wants here: they want the file to save and upload manually, so we open it.
 */
export async function shareCenterImage(
  id: string,
  title: string,
  fmt: ShareFormat = "story",
): Promise<ImageShareResult> {
  const url = `/c/${id}/story?f=${fmt}`;
  const touch =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0);

  if (touch) {
    try {
      const res = await fetch(url);
      if (res.ok && typeof navigator.canShare === "function") {
        const blob = await res.blob();
        const file = new File([blob], `${id}-${fmt}.png`, { type: "image/png" });
        if (navigator.canShare({ files: [file] }) && typeof navigator.share === "function") {
          try {
            await navigator.share({ files: [file], title });
            return "shared";
          } catch {
            /* cancelled, or the user activation expired → fall through and open it */
          }
        }
      }
    } catch {
      /* fall through to the universal fallback */
    }
  }

  if (typeof window !== "undefined") {
    // Desktop, and the mobile fallback: open the PNG so it can be saved (right-click, or
    // long-press on iOS, where `<a download>` is ignored).
    window.open(url, "_blank", "noopener,noreferrer");
    return "downloaded";
  }
  return "error";
}
