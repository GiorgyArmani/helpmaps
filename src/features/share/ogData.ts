import type { Center } from "@/domain/types";
import { BRAND, COUNTRY, LANGUAGE, regionLabel, typeStyle } from "@/config";
import { translator } from "@/i18n";
import { daysSince, lastTouched, statusOf } from "@/domain/center";
import type { DictKey } from "@/i18n";

/**
 * Everything the share images need about one point, resolved once.
 *
 * The image routes run inside Satori (`next/og`), which is fussy: it parses a subset of
 * CSS and cannot resolve `oklch()` colours. Point-type colours come from
 * `config/map.ts`, which is why that file insists on hex values — if a clone puts an
 * `oklch()` there the map still works and the banners silently lose their accent.
 */
export interface OgCenterData {
  name: string;
  typeLabel: string;
  accent: string;
  place: string;
  /** What to ask for, already resolved: the free-text need, or the ways to help. */
  need: string;
  receives: string[];
  status: { label: string; fg: string; bg: string } | null;
  /** "Actualizado hace N días" — a shared image circulates for days. */
  updatedLabel: string | null;
  contact: string;
  /** Attribution line, only for rows that really came from a partner feed. */
  attribution: string | null;
  brandLine: string;
}

const STATUS_STYLE = {
  abierto: { fg: "#065F46", bg: "#A7F3D0" },
  lleno: { fg: "#7C2D12", bg: "#FDE68A" },
  cerrado: { fg: "#7F1D1D", bg: "#FECACA" },
} as const;

export function ogCenterData(center: Center): OgCenterData {
  const t = translator(LANGUAGE.default);
  const info = center.info;
  const status = statusOf(center);

  const helpAsAsk = (info?.help ?? []).map((k) => t(`help.${k}` as DictKey)).join(" · ");

  const touched = lastTouched(center);
  const days = daysSince(touched);

  return {
    name: center.name,
    typeLabel: t(`type.${center.type}` as DictKey).toUpperCase(),
    accent: typeStyle(center.type).color,
    place: [center.municipality, regionLabel(center.region)].filter(Boolean).join(" · "),
    // A civic initiative usually states no need: the ways to help ARE the ask.
    need: (info?.needs?.trim() || helpAsAsk).trim(),
    receives: info?.receives ?? [],
    status: status ? { label: t(`status.${status}` as DictKey).toUpperCase(), ...STATUS_STYLE[status] } : null,
    updatedLabel:
      days == null
        ? null
        : days === 0
          ? t("og.updatedToday")
          : days === 1
            ? t("og.updatedOneDay")
            : t("og.updatedDays", { n: days }),
    contact: center.whatsapp || center.phone || "",
    attribution: info?.external_id && info.source ? t("center.source", { source: info.source }) : null,
    brandLine: `${COUNTRY.host} · ${BRAND.tagline}`,
  };
}
