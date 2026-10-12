"use client";

import { OFFERS_EXPIRE_DAYS, offersState } from "@/domain/center";
import { Icon } from "@/ui/icons";
import { useI18n, useTimeAgo } from "@/i18n/context";

/**
 * Lo que un punto tiene para entregar, con la fecha en que alguien lo confirmó.
 *
 * ── POR QUÉ LA FECHA VA PEGADA A LA LISTA ───────────────────────────────────
 *
 * «Recibe» puede llevar meses escrito y seguir siendo verdad: un acopio que acepta ropa la
 * acepta en octubre igual que en julio. Esto no. Lo que hay en un estante se acaba esa
 * misma tarde, y una lista sin fecha se lee como una promesa. Por eso la fecha no va en un
 * rincón de la ficha sino debajo de los chips, y a la semana deja de ser un dato para
 * convertirse en un aviso: llama antes de ir.
 *
 * ── LO QUE VE EL PÚBLICO Y LO QUE VE QUIEN GESTIONA ────────────────────────
 *
 * Caducada, la lista no se enseña al público — quien llama a este componente ya la filtró
 * con `currentOffers`. Quien gestiona el punto sí la ve (`manage`), apagada y con el
 * motivo: si desapareciera sin más, parecería que la ficha perdió lo que escribió.
 *
 * El verde va en el icono y en el fondo, nunca en la letra: `--ok` sobre blanco no llega
 * al 4,5:1 de un texto de 12px.
 */
export default function OffersView({
  offers,
  confirmedAt,
  manage = false,
}: {
  offers: string[];
  confirmedAt: string | null;
  /** La vista de quien gestiona: enseña también lo caducado, y lo dice. */
  manage?: boolean;
}) {
  const { t } = useI18n();
  const ago = useTimeAgo();
  const state = offersState(confirmedAt);

  if (offers.length === 0) return null;
  if (state === "expired" && !manage) return null;

  return (
    <div className={`doffer${state === "expired" ? " doffer-off" : ""}`}>
      <div className="dtags">
        {offers.map((o) => (
          <span key={o} className="dtag dtag-have">
            <Icon.check />
            {o}
          </span>
        ))}
      </div>

      {state === "expired" ? (
        <p className="doffer-when doffer-warn">
          <Icon.alert />
          <span>{t("offers.expired", { n: OFFERS_EXPIRE_DAYS })}</span>
        </p>
      ) : state === "aging" ? (
        <p className="doffer-when doffer-warn">
          <Icon.alert />
          <span>
            {confirmedAt ? `${t("center.confirmed", { ago: ago(confirmedAt) })}. ` : ""}
            {t("offers.callFirst")}
          </span>
        </p>
      ) : (
        <p className="doffer-when">
          {t("offers.forWhom")}
          {confirmedAt ? ` ${t("center.confirmed", { ago: ago(confirmedAt) })}.` : ""}
        </p>
      )}
    </div>
  );
}
