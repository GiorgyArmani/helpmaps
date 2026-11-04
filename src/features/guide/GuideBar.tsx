"use client";

import { useI18n } from "@/i18n/context";
import { Icon } from "@/ui/icons";
import { formatKm } from "@/domain/nearby";
import {
  googleMapsUrl,
  hasArrived,
  metersBetween,
  setTravelMode,
  stopGuide,
  useGuide,
  walkMinutes,
  wazeUrl,
  type RouteLeg,
  type TravelMode,
} from "@/features/guide/guide";

/**
 * La tarjeta de «Cómo llegar», encima del mapa: cuánto falta a pie y en carro, cuál se
 * dibuja, y los botones para seguir paso a paso en Google Maps o Waze.
 *
 * Lo que tarda se dibuja como el hueco que va a ocupar —primero el GPS, luego la ruta—, así
 * que la tarjeta no cambia de alto a medida que llegan las cosas.
 */
export default function GuideBar() {
  const guide = useGuide();
  const { t, lang } = useI18n();
  if (!guide) return null;

  const { target, fix, status, route, routeStatus, mode } = guide;
  const meters = fix ? metersBetween(fix, target) : null;
  const arrived = fix && meters !== null ? hasArrived(meters, fix.accuracy) : false;
  const noFix = status === "denied" || status === "unavailable";

  const duration = (min: number) =>
    min >= 60
      ? t("guide.hmin", { h: Math.floor(min / 60), m: min % 60 })
      : t("guide.min", { n: min });

  const modeButton = (m: TravelMode, leg: RouteLeg | null) =>
    leg ? (
      <button
        key={m}
        type="button"
        className={mode === m ? "guide-mode guide-mode-on" : "guide-mode"}
        aria-pressed={mode === m}
        onClick={() => setTravelMode(m)}
      >
        {m === "foot" ? <Icon.walk /> : <Icon.car />}
        <span className="guide-mode-txt">
          <b>{duration(leg.min)}</b>
          <span>
            {t(m === "foot" ? "guide.foot" : "guide.car")} · {formatKm(leg.km, lang)}
          </span>
        </span>
      </button>
    ) : null;

  let body: React.ReactNode;
  if (noFix) {
    body = <p className="guide-msg">{t(status === "denied" ? "guide.denied" : "guide.unavailable")}</p>;
  } else if (arrived) {
    body = (
      <div className="guide-arrived" role="status">
        <Icon.check />
        <span>
          <b>{t("guide.arrived")}</b>
          <span>{t("guide.arrivedHint")}</span>
        </span>
      </div>
    );
  } else if (fix && routeStatus === "failed" && meters !== null) {
    body = (
      <p className="guide-msg">
        {t("guide.straight", {
          km: formatKm(meters / 1000, lang),
          min: duration(walkMinutes(meters / 1000)),
        })}
      </p>
    );
  } else if (route) {
    body = <div className="guide-modes">{[modeButton("foot", route.foot), modeButton("car", route.car)]}</div>;
  } else {
    // Esperando el GPS o la ruta: los dos huecos de los modos, con lo que está pasando dicho.
    body = (
      <div className="guide-modes" aria-busy="true">
        <span className="skel guide-mode-skel" />
        <span className="skel guide-mode-skel" />
        <span className="sr-only" role="status">
          {t(fix ? "guide.routing" : "guide.locating")}
        </span>
      </div>
    );
  }

  return (
    <section className="guide" aria-label={t("guide.region")}>
      <div className="guide-head">
        <span className="guide-pin" aria-hidden="true">
          <Icon.directions />
        </span>
        <div className="guide-title">
          <span className="guide-kick">{t("center.directions")}</span>
          <b className="guide-name">{target.name}</b>
        </div>
        <button type="button" className="guide-x" aria-label={t("guide.exit")} onClick={stopGuide}>
          <Icon.close />
        </button>
      </div>

      {body}

      {fix && fix.accuracy > 100 && !arrived ? (
        <p className="guide-note">{t("guide.approx", { m: Math.round(fix.accuracy) })}</p>
      ) : null}

      <div className="guide-apps">
        <span className="guide-apps-lbl">{t("guide.stepBy")}</span>
        <a className="btng" href={googleMapsUrl(target, mode)} target="_blank" rel="noopener noreferrer">
          Google Maps
        </a>
        <a className="btng" href={wazeUrl(target)} target="_blank" rel="noopener noreferrer">
          Waze
        </a>
      </div>
    </section>
  );
}
