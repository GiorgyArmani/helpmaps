"use client";

import type { Center } from "@/domain/types";
import type { Region } from "@/config/types";
import { RADIUS_CHOICES, formatKm, type Near, type RadiusKm } from "@/domain/nearby";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import CenterCard from "@/features/centers/CenterCard";
import DigitalCard from "@/features/centers/DigitalCard";
import type { LocateStatus } from "@/features/nearby/useMyLocation";

/**
 * La pestaña «Cerca»: lo que hay a la redonda, ordenado por distancia real.
 *
 * POR QUÉ ES UNA PESTAÑA Y NO UN FILTRO MÁS
 *
 * «Puntos» y «Digitales» contestan «qué hay»; ésta contesta «a dónde voy AHORA», que es
 * la pregunta con la que la gente abre esto en la calle. Un filtro «cerca de mí» encima
 * de la lista de puntos habría heredado sus chips de tipo y su filtro de {region} — y un
 * filtro de tipo activo mientras se pregunta por distancia es exactamente la clase de
 * combinación que hace que una lista vacía se lea como «aquí no hay nada».
 *
 * Por eso aquí sólo manda el radio: el buscador sigue valiendo (llega ya aplicado), y
 * todo lo demás se apaga a propósito.
 *
 * NO PIDE LA UBICACIÓN SOLA. El permiso se pide cuando alguien toca el botón, nunca al
 * montar: un mapa de emergencia que dispara el diálogo del navegador en cuanto se abre
 * se gana un «bloquear» de por vida, y quien lo bloqueó no vuelve a ver esta pestaña
 * funcionar nunca. Ver `useMyLocation.ts` para qué se hace con la posición (nada que
 * salga del teléfono).
 *
 * Presentacional, como el resto de vistas del panel: el estado vive en `AppShell`.
 */
export default function NearbyPanel({
  located,
  status,
  near,
  digital,
  zone,
  radius,
  onRadius,
  onRequest,
  onForget,
  onSelect,
  onBrowseAll,
}: {
  /** Hay una posición con la que ordenar. Con `false` sólo se ve la invitación. */
  located: boolean;
  status: LocateStatus;
  near: Near[];
  /** Iniciativas sin sede que atienden la zona. Sin distancia: van en su propio bloque. */
  digital: Center[];
  zone: Region | null;
  radius: RadiusKm;
  onRadius: (km: RadiusKm) => void;
  onRequest: () => void;
  onForget: () => void;
  onSelect: (id: string) => void;
  /** Salida para quien no da el permiso: la lista completa, filtrable por {region}. */
  onBrowseAll: () => void;
}) {
  const { t, lang } = useI18n();
  const site = useSite();

  // ── Sin posición todavía ────────────────────────────────────────────────
  if (!located) {
    return (
      <div className="nearby">
        <div className="nb-ask">
          <span className="nb-askic">
            <Icon.target />
          </span>
          <b className="nb-askt">{t("nearby.askTitle")}</b>
          <p className="nb-askp">{t("nearby.askBody")}</p>

          {status === "denied" || status === "unavailable" ? (
            <p className="nb-err" role="status">
              {t(status === "denied" ? "nearby.denied" : "nearby.unavailable")}
            </p>
          ) : null}

          <button
            type="button"
            className="nb-go"
            onClick={onRequest}
            disabled={status === "locating"}
          >
            {status === "locating"
              ? t("nearby.locating")
              : status === "denied" || status === "unavailable"
                ? t("nearby.retry")
                : t("nearby.use")}
          </button>

          <p className="nb-priv">
            <Icon.lock />
            {t("nearby.privacy")}
          </p>

          <button type="button" className="nb-alt" onClick={onBrowseAll}>
            {t("nearby.altHint", { region: site.country.regionNoun.one })}
          </button>
        </div>
      </div>
    );
  }

  // ── Con posición ────────────────────────────────────────────────────────
  return (
    <div className="nearby">
      <div className="nb-bar" role="group" aria-label={t("nearby.radius")}>
        <span className="nb-radlbl">{t("nearby.radius")}</span>
        {RADIUS_CHOICES.map((km) => (
          <button
            key={km}
            type="button"
            className={`nb-rad${km === radius ? " nb-rad-on" : ""}`}
            aria-pressed={km === radius}
            onClick={() => onRadius(km)}
          >
            {formatKm(km, lang)}
          </button>
        ))}
      </div>

      <div className="nb-zone">
        <span className="nb-zonet">
          {zone ? t("nearby.zone", { region: zone.name }) : t("nearby.zoneUnknown")}
        </span>
        <button type="button" className="nb-forget" onClick={onForget}>
          {t("nearby.forget")}
        </button>
      </div>

      {near.length === 0 ? (
        <p className="empty">
          <b>{t("nearby.empty", { radius: formatKm(radius, lang) })}</b>
          <br />
          {t("nearby.emptyHint")}
        </p>
      ) : (
        <p className="nb-count">
          {near.length === 1 ? t("nearby.countOne") : t("nearby.count", { n: near.length })}
          <span className="nb-straight">{t("nearby.straightLine")}</span>
        </p>
      )}

      {near.map(({ center, km }) => (
        <CenterCard
          key={center.id}
          center={center}
          onSelect={onSelect}
          distanceLabel={formatKm(km, lang)}
        />
      ))}

      {/* Las digitales van DEBAJO y en su propio bloque: no tienen distancia, y meterlas
          en el orden por cercanía obligaría a inventarle una a cada una. */}
      {digital.length > 0 ? (
        <>
          <p className="nb-sect">
            <Icon.globe />
            {t("nearby.digitalTitle")}
          </p>
          {digital.map((center) => (
            <DigitalCard key={center.id} center={center} onSelect={onSelect} />
          ))}
        </>
      ) : null}
    </div>
  );
}
