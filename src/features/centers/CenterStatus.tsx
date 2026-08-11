"use client";

import type { Center } from "@/domain/types";
import { daysSince, isStale, lastTouched, statusOf } from "@/domain/center";
import { MAPCFG } from "@/config";
import { Badge } from "@/ui/primitives";
import { Icon } from "@/ui/icons";
import { useI18n, useTimeAgo } from "@/i18n/context";

/**
 * Status and freshness — the two things that decide whether it is worth travelling.
 *
 * Two rules hold everywhere this renders:
 *   • Unknown stays unknown. A point with no status shows no badge; nothing defaults to
 *     "open", because claiming a closed point is open is the one direction of this field
 *     that sends a family to a shut door.
 *   • The warning renders ABOVE the needs, never below: whether the point still exists
 *     outranks what it is asking for.
 */
export function StatusBadge({ center }: { center: Center }) {
  const { t } = useI18n();
  const status = statusOf(center);
  if (!status) return null;
  if (status === "cerrado") return <Badge tone="danger">{t("status.cerrado")}</Badge>;
  if (status === "lleno") return <Badge tone="warn">{t("status.lleno")}</Badge>;
  return <Badge tone="ok">{t("status.abierto")}</Badge>;
}

/** The warning someone must see before deciding to go. Null when there is none. */
export function StatusWarning({ center }: { center: Center }) {
  const { t } = useI18n();
  const status = statusOf(center);

  if (status === "cerrado") {
    return (
      <div className="note note-danger" role="alert">
        <Icon.alert />
        <span>{t("status.closedWarning")}</span>
      </div>
    );
  }

  if (status === "lleno") {
    return (
      <div className="note note-warn" role="alert">
        <Icon.alert />
        <span>{t("status.fullWarning")}</span>
      </div>
    );
  }

  if (isStale(center)) {
    const days = daysSince(lastTouched(center)) ?? MAPCFG.staleAfterDays;
    return (
      <div className="note note-warn" role="alert">
        <Icon.alert />
        <span>{t("status.staleWarning", { n: days })}</span>
      </div>
    );
  }

  return null;
}

/** Compact "confirmado hace 3 días" line for list rows and headers. */
export function UpdatedLine({ center }: { center: Center }) {
  const { t } = useI18n();
  const ago = useTimeAgo();
  const confirmed = center.info?.last_confirmed_at;
  const touched = lastTouched(center);
  if (!touched) return <span className="small mut">{t("center.neverConfirmed")}</span>;
  return (
    <span className="small mut">
      {confirmed
        ? t("center.confirmed", { ago: ago(confirmed) })
        : t("center.updated", { ago: ago(touched) })}
    </span>
  );
}
