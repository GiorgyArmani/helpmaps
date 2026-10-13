"use client";

import { useEffect, useMemo, useState } from "react";
import { BADGES } from "@/domain/badges";
import { isUnread, type Notif, type NotifGroup } from "@/domain/notifications";
import { Icon } from "@/ui/icons";
import { ListSkeleton } from "@/ui/Skeleton";
import { useI18n, useTimeAgo } from "@/i18n/context";
import type { DictKey, Translate } from "@/i18n";
import type { NotificationsState } from "@/features/notifications/useNotifications";

/**
 * Notificaciones: lo que cambió en lo tuyo y en los puntos que guardaste.
 *
 * ── UNA VISTA DEL PANEL, COMO «MI CUENTA» ───────────────────────────────────
 *
 * No es una página ni una campana más en la barra, que en 390px ya lleva lo que cabe: se
 * entra desde el avatar, que es donde vive lo tuyo, y el número de nuevas va sobre él.
 *
 * ── CADA FILA LLEVA A ALGUNA PARTE ──────────────────────────────────────────
 *
 * Una novedad de un punto abre ese punto en el mapa; una de tu progreso abre tu cuenta,
 * donde está el nivel con su barra. Una notificación que sólo se puede leer es un cartel.
 *
 * ── SE DAN POR VISTAS AL ABRIR ──────────────────────────────────────────────
 *
 * Sin «marcar como leída» una por una: son avisos, no tareas. Lo que era nuevo al entrar
 * se queda marcado mientras la vista sigue abierta —si no, el punto se apagaría antes de
 * poder leerlo— y el número del avatar se va en el acto.
 */

type Filter = "all" | NotifGroup;
const FILTERS: Filter[] = ["all", "progress", "points"];

type Glyph = keyof typeof Icon;

/** El icono y el tono de cada tipo. El tono sale de los tokens, nunca de un color escrito. */
const LOOK: Record<Notif["kind"], { icon: Glyph; tone: "brand" | "ok" | "warn" | "mut" }> = {
  level: { icon: "spark", tone: "brand" },
  badge: { icon: "spark", tone: "brand" },
  xp: { icon: "plus", tone: "brand" },
  submission: { icon: "check", tone: "ok" },
  team: { icon: "users", tone: "brand" },
  post: { icon: "news", tone: "brand" },
  campaign: { icon: "heart", tone: "warn" },
  goal: { icon: "check", tone: "ok" },
  event: { icon: "clock", tone: "brand" },
  offers: { icon: "box", tone: "ok" },
  update: { icon: "pencil", tone: "mut" },
};

/** Lo que dice cada fila: una frase que se entiende sola y, debajo, el detalle. */
function wording(n: Notif, t: Translate, lang: string): { title: string; detail: string } {
  switch (n.kind) {
    case "level":
      return {
        title: t("notif.level", { level: t(`level.${n.code}` as DictKey) }),
        detail: t("rec.xp", { n: n.n }),
      };
    case "badge": {
      const badge = BADGES.find((b) => b.code === n.code);
      return {
        title: t("notif.badge", { badge: badge ? t(badge.label) : n.code }),
        detail: badge ? t(badge.hint) : "",
      };
    }
    case "xp":
      return { title: t("notif.xp", { n: n.n }), detail: t(`notif.xp.${n.code}` as DictKey) };
    case "submission":
      return {
        title: t(n.code === "approved" ? "notif.subApproved" : "notif.subRejected"),
        detail: n.text,
      };
    case "team":
      return {
        title: t(n.code === "approved" ? "notif.teamApproved" : "notif.teamRejected"),
        detail: "",
      };
    case "post":
      return { title: t("notif.post", { name: n.name }), detail: n.text };
    case "campaign":
      return { title: t("notif.campaign", { name: n.name }), detail: n.text };
    case "goal":
      return { title: t("notif.goal", { name: n.name }), detail: n.text };
    case "event": {
      const day = n.when
        ? new Date(n.when).toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" })
        : "";
      return { title: t("notif.event", { name: n.name }), detail: day ? `${n.text} · ${day}` : n.text };
    }
    case "offers":
      return { title: t("notif.offers", { name: n.name }), detail: n.text };
    case "update":
      return {
        title: t("notif.update", { name: n.name }),
        detail: n.code ? t(`status.${n.code}` as DictKey) : "",
      };
  }
}

export default function NotificationsView({
  notifs,
  onOpenCenter,
  onOpenAccount,
}: {
  notifs: NotificationsState;
  onOpenCenter: (id: string) => void;
  onOpenAccount: () => void;
}) {
  const { t, lang } = useI18n();
  const ago = useTimeAgo();
  const [filter, setFilter] = useState<Filter>("all");
  // Hasta dónde estaba visto AL ENTRAR. Es lo que decide qué fila lleva el punto de
  // «nuevo» durante esta visita, aunque el contador ya se haya puesto a cero.
  const [since] = useState(notifs.seenAt);

  const { loaded, markSeen } = notifs;
  useEffect(() => {
    if (loaded) markSeen();
  }, [loaded, markSeen]);

  const shown = useMemo(
    () => (filter === "all" ? notifs.items : notifs.items.filter((n) => n.group === filter)),
    [notifs.items, filter],
  );

  return (
    <div className="ntf">
      <div className="feed-modes" role="tablist" aria-label={t("notif.title")}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`feed-mode${filter === f ? " feed-mode-on" : ""}`}
            onClick={() => setFilter(f)}
          >
            {t(`notif.tab.${f}` as DictKey)}
          </button>
        ))}
      </div>

      {!loaded ? (
        <>
          <p className="vh" role="status">
            {t("common.loading")}
          </p>
          <div className="ntf-list">
            <ListSkeleton n={5} />
          </div>
        </>
      ) : shown.length === 0 ? (
        <div className="ntf-empty">
          <span className="ntf-empty-ic" aria-hidden="true">
            <Icon.bell />
          </span>
          <b>{t("notif.empty")}</b>
          <p>{t(`notif.empty.${filter}` as DictKey)}</p>
        </div>
      ) : (
        <ul className="ntf-list">
          {shown.map((n) => {
            const { title, detail } = wording(n, t, lang);
            const look = LOOK[n.kind];
            const Glyph = Icon[look.icon];
            const fresh = isUnread(n, since);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  className={`ntf-row${fresh ? " ntf-row-new" : ""}`}
                  onClick={() => (n.centerId ? onOpenCenter(n.centerId) : onOpenAccount())}
                >
                  <span className={`ntf-ic ntf-ic-${look.tone}`} aria-hidden="true">
                    <Glyph />
                  </span>
                  <span className="ntf-txt">
                    <span className="ntf-title">{title}</span>
                    {detail ? <span className="ntf-detail">{detail}</span> : null}
                    <span className="ntf-time">{ago(n.at)}</span>
                  </span>
                  {/* El punto no es lo único que lo dice: la fila nueva va además en negrita
                      y lleva la palabra para quien no ve el color. */}
                  {fresh ? (
                    <span className="ntf-dot">
                      <span className="vh">{t("notif.new")}</span>
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {loaded ? <p className="acc-fine">{t("notif.fine")}</p> : null}
    </div>
  );
}
