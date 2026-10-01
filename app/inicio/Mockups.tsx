import { typeStyle } from "@/config";
import type { LocationType } from "@/domain/types";
import type { translator } from "@/i18n";
import { Icon, TypeGlyph } from "@/ui/icons";

type T = ReturnType<typeof translator>;

/**
 * Las pantallas del recorrido de `/inicio`: lo que hace una PERSONA en la app, no una
 * organización (ésas están en `app/organizaciones/Mockups.tsx`).
 *
 * Mismo criterio que allí: marcado con los tokens de la app y no capturas, así se re-marcan
 * por país, se traducen y no pesan. Reusan las clases `mk-*` de `orgs.css` para lo que ya
 * existe (pestañas, eventos, barra) y añaden las suyas en `inicio.css` con el prefijo `mk-`
 * también, porque viven dentro del mismo marco de teléfono.
 *
 * No son interactivas: `FeatureTour` pone el teléfono `aria-hidden` e `inert`. Los nombres
 * de los puntos son de ejemplo y la página lo dice bajo el recorrido.
 */

/** Una fila de punto: icono del tipo, nombre, tipo · distancia y si abre. */
function Row({
  t,
  type,
  name,
  km,
  open,
}: {
  t: T;
  type: LocationType;
  name: string;
  km: string;
  open: boolean;
}) {
  const style = typeStyle(type);
  return (
    <div className="mk-row">
      <span className="mk-row-ic" style={{ ["--tc" as string]: style.color }}>
        <TypeGlyph name={style.icon} size={16} />
      </span>
      <span className="mk-row-txt">
        <b>{name}</b>
        <span>
          {t(`type.${type}`)} · {km}
        </span>
      </span>
      <span className={open ? "mk-row-st mk-row-open" : "mk-row-st"}>
        {open ? t("hours.openNow") : t("home.demo.closed")}
      </span>
    </div>
  );
}

export function NearScreen({ t }: { t: T }) {
  return (
    <>
      {/* Un trozo de mapa con «tú» en el centro y los puntos alrededor. */}
      <div className="mk-map">
        <span className="mk-pin" style={{ left: "26%", top: "38%", ["--tc" as string]: typeStyle("comedor").color }} />
        <span className="mk-pin" style={{ left: "70%", top: "30%", ["--tc" as string]: typeStyle("shelter").color }} />
        <span className="mk-pin" style={{ left: "62%", top: "70%", ["--tc" as string]: typeStyle("donation_centre").color }} />
        <span className="mk-pin" style={{ left: "18%", top: "76%", ["--tc" as string]: typeStyle("shelter").color }} />
        <span className="mk-me" style={{ left: "48%", top: "52%" }} />
      </div>
      <div className="mk-body">
        <div className="mk-seg">
          <span>{t("map.points")}</span>
          <span className="mk-seg-on">
            <Icon.target />
            {t("panel.tab.nearby")}
          </span>
        </div>
        <p className="mk-h">{t("nearby.count", { n: 8 })}</p>
        <Row t={t} type="comedor" name={t("home.demo.p1")} km="450 m" open />
        <Row t={t} type="shelter" name={t("home.demo.p2")} km="1,2 km" open />
        <Row t={t} type="donation_centre" name={t("home.demo.p3")} km="2,8 km" open={false} />
      </div>
    </>
  );
}

/**
 * El lado de quien NECESITA ayuda: la ficha de un comedor vista para ir a él. Si está
 * abierto, hasta qué hora, dónde queda, y cómo llegar o preguntar antes de ir.
 */
export function GetScreen({ t }: { t: T }) {
  const style = typeStyle("comedor");
  return (
    <>
      <div className="mk-top">
        <span className="mk-back">
          <Icon.back />
        </span>
        <span className="mk-photo mk-photo-sm" style={{ color: style.color }}>
          <TypeGlyph name={style.icon} size={18} />
        </span>
        <span className="mk-top-txt">
          <b className="mk-name">{t("home.demo.p1")}</b>
          <span className="mk-meta">{t("type.comedor")} · 450 m</span>
        </span>
      </div>
      <div className="mk-body">
        <span className="mk-open">
          <i />
          {t("hours.openNow")} · {t("hours.closesAt", { time: "1:30 p. m." })}
        </span>
        <div className="mk-acts">
          <span className="mk-act mk-act-main">
            <Icon.directions />
            {t("center.directions")}
          </span>
          <span className="mk-act">
            <Icon.phone />
            {t("center.call")}
          </span>
          <span className="mk-act">
            <Icon.whatsapp />
            {t("center.whatsapp")}
          </span>
        </div>
        <div className="mk-table">
          <span>
            <small>{t("hours.title")}</small>
            <b>{t("home.demo.hours")}</b>
          </span>
          <span>
            <small>{t("orgs.demo.addressLabel")}</small>
            <b>{t("orgs.demo.address")}</b>
          </span>
        </div>
        <p className="mk-upd">
          <Icon.check />
          {t("home.demo.updated")}
        </p>
      </div>
    </>
  );
}

export function NeedsScreen({ t }: { t: T }) {
  const style = typeStyle("shelter");
  return (
    <>
      <div className="mk-top">
        <span className="mk-back">
          <Icon.back />
        </span>
        <span className="mk-photo mk-photo-sm" style={{ color: style.color }}>
          <TypeGlyph name={style.icon} size={18} />
        </span>
        <span className="mk-top-txt">
          <b className="mk-name">{t("home.demo.p2")}</b>
          <span className="mk-meta">
            {t("type.shelter")} · 1,2 km
          </span>
        </span>
      </div>
      <div className="mk-body">
        <span className="mk-open">
          <i />
          {t("hours.openNow")}
        </span>
        <div className="mk-need">
          <b className="mk-need-h">
            <Icon.alert />
            {t("home.demo.needsNow")}
          </b>
          <span className="mk-chips mk-chips-need">
            <span>{t("supply.colchonetas")}</span>
            <span>{t("supply.panales")}</span>
            <span>{t("supply.agua")}</span>
          </span>
        </div>
        <p className="mk-sub">{t("home.demo.receives")}</p>
        <span className="mk-chips mk-chips-soft">
          <span>{t("supply.ropa")}</span>
          <span>{t("supply.alimentos")}</span>
          <span>{t("supply.cobijas")}</span>
          <span>{t("supply.higiene")}</span>
        </span>
        <p className="mk-upd">
          <Icon.check />
          {t("home.demo.updated")}
        </p>
        <div className="mk-acts mk-acts-2">
          <span className="mk-act mk-act-main">
            <Icon.directions />
            {t("orgs.demo.directions")}
          </span>
          <span className="mk-act">
            <Icon.heart />
            {t("home.demo.donateData")}
          </span>
        </div>
      </div>
    </>
  );
}

export function JoinScreen({ t }: { t: T }) {
  return (
    <>
      <div className="mk-top">
        <span className="mk-back">
          <Icon.back />
        </span>
        <span className="mk-photo mk-photo-sm" style={{ color: typeStyle("comedor").color }}>
          <TypeGlyph name={typeStyle("comedor").icon} size={18} />
        </span>
        <span className="mk-top-txt">
          <b className="mk-name">{t("home.demo.p1")}</b>
          <span className="mk-meta">{t("type.comedor")} · 450 m</span>
        </span>
      </div>
      <div className="mk-body">
        <div className="mk-tabs">
          <span className="mk-tab">{t("tab.info")}</span>
          <span className="mk-tab mk-tab-on">
            {t("tab.agenda")}
            <span className="mk-tab-n">2</span>
          </span>
          <span className="mk-tab">{t("tab.posts")}</span>
        </div>
        <div className="mk-ev">
          <span className="mk-ev-when">
            <b>12</b>
            <span>{t("orgs.demo.month")}</span>
          </span>
          <span className="mk-ev-body">
            <b className="mk-ev-t">{t("orgs.demo.event")}</b>
            <span className="mk-ev-meta">{t("orgs.demo.eventMeta")}</span>
            <span className="mk-chips">
              <span>{t("orgs.demo.skill1")}</span>
              <span>{t("orgs.demo.skill3")}</span>
            </span>
            {/* El botón pasa de «Me anoto» a «Anotado»: lo que se ve al tocarlo. */}
            <span className="mk-ev-row">
              <span className="mk-join mk-join-flip">
                <span className="mk-join-a">
                  <Icon.plus />
                  {t("event.join")}
                </span>
                <span className="mk-join-b">
                  <Icon.check />
                  {t("home.demo.joined")}
                </span>
              </span>
              <span className="mk-cal">
                <Icon.clock />
                {t("event.addToCalendar")}
              </span>
            </span>
            <span className="mk-ev-count">
              <Icon.users />
              {t("event.goingN", { n: 15 })}
            </span>
          </span>
        </div>
        <div className="mk-ev mk-ev-dim">
          <span className="mk-ev-when">
            <b>19</b>
            <span>{t("orgs.demo.month")}</span>
          </span>
          <span className="mk-ev-body">
            <b className="mk-ev-t">{t("orgs.demo.event2")}</b>
            <span className="mk-ev-meta">{t("orgs.demo.event2Meta")}</span>
          </span>
        </div>
      </div>
    </>
  );
}

export function LevelScreen({ t }: { t: T }) {
  return (
    <>
      <div className="mk-lvl">
        <span className="mk-lvl-badge">
          <Icon.spark />
        </span>
        <small>{t("rec.title")}</small>
        <b className="mk-lvl-n">{t("level.2")}</b>
        <div className="mk-bar mk-bar-lvl">
          <span />
        </div>
        <span className="mk-lvl-meta">{t("rec.toNext", { n: 16, level: t("level.3") })}</span>
      </div>
      <div className="mk-body">
        {/* El aviso que sale al tocar «Estoy aquí» en un punto. */}
        <span className="mk-toast">
          <Icon.check />
          <span>
            <b>{t("home.demo.here")}</b> · {t("home.demo.xpGain")}
          </span>
        </span>
        <p className="mk-sub">{t("rec.badges")}</p>
        <div className="mk-badges">
          <span>
            <i>
              <Icon.spark />
            </i>
            {t("badge.first")}
          </span>
          <span>
            <i>
              <Icon.eye />
            </i>
            {t("badge.confirmer")}
          </span>
          <span>
            <i>
              <Icon.hand />
            </i>
            {t("badge.hands")}
          </span>
          <span className="mk-badge-off">
            <i>
              <Icon.heart />
            </i>
            {t("badge.giver")}
          </span>
        </div>
      </div>
    </>
  );
}
