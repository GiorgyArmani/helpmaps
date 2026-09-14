"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import { FLAG_ICON, LANG_NAME } from "@/ui/flags";
import { openConsent } from "@/features/consent/consent";
import { useDismiss } from "@/ui/useDismiss";
import type { StaffState } from "@/features/admin/useStaffSession";
import type { AccountState } from "@/features/account/useAccount";
import { avatarInitial, useSessionPeek } from "@/features/account/useSessionPeek";
import { savedLabel } from "@/features/account/ledger";

const STAFF_HINT = "hmWasStaff";

/**
 * El avatar de la barra, y lo que se despliega debajo.
 *
 * ── POR QUÉ ESTO REEMPLAZA AL CANDADO ───────────────────────────────────────
 *
 * El candado decía una sola cosa —"aquí se entra al panel del equipo"— y era, a la vez, el
 * único sitio de toda la aplicación desde el que una persona con cuenta podía llegar a lo
 * suyo. Quien había guardado tres refugios tocaba un candado para verlos. Eso no es un
 * problema de rótulo: es que la cuenta de persona no tenía casa.
 *
 * Ahora la barra hace el gesto que cualquiera reconoce de un mapa: tu inicial arriba a la
 * derecha y, debajo, tus cosas. El panel del equipo pasa a ser UNA entrada más del menú,
 * que es lo que es: algo que casi nadie tiene y que no merecía el sitio de honor.
 *
 * ── LA BARRA AYUDA A ENCONTRAR; ESTE MENÚ ES LO TUYO ─────────────────────────
 *
 * La barra se quedó con dos acciones: Colaborar —las formas de ayudar— y este avatar. Lo
 * demás que vivía en ella (la bandera del idioma y el «?» del recorrido) se consulta una vez
 * por visita y ocupaba el sitio del buscador, así que vive aquí, igual con o sin sesión.
 *
 * Y cada destino aparece UNA vez. «Tus puntos guardados» llevaba al mismo sitio que la ficha
 * de arriba, que ya dice cuántos hay; y «Sumarme al equipo» es una de las tres opciones de
 * Colaborar, que es donde alguien que quiere ayudar la busca.
 *
 * ── LO QUE SE RESUELVE, Y CUÁNDO ────────────────────────────────────────────
 *
 * Dibujar el avatar no cuesta señal: `useSessionPeek` lee el token del propio navegador.
 * El perfil y el rol —dos viajes— se piden al ABRIR el menú, que es cuando ya hay un gesto
 * que los justifica. El orden importa en una aplicación pensada para una barra de
 * cobertura: el mapa primero y todo lo demás cuando se pida.
 */
export default function AccountMenu({
  open,
  onOpenChange,
  account,
  staff,
  pending,
  onOpenAccount,
  onOpenPanel,
  onHelp,
  onSignOut,
  managesInitiative = false,
  onOpenInitiative,
  panelOpen = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountState;
  staff: StaffState;
  pending: number;
  onOpenAccount: () => void;
  onOpenPanel: () => void;
  /** Abre el recorrido guiado. */
  onHelp: () => void;
  onSignOut: () => void;
  /**
   * Gestiona algún punto: entonces le sale «Tu iniciativa», que es lo primero que abre
   * quien tiene una. Casi nadie lo es, así que la entrada no existe para casi nadie.
   */
  managesInitiative?: boolean;
  onOpenInitiative?: () => void;
  /** El panel del equipo está abierto: su fila se marca en vez de desaparecer. */
  panelOpen?: boolean;
}) {
  const { t, lang, setLang, available } = useI18n();
  const site = useSite();
  const peek = useSessionPeek();

  // Con sesión según CUALQUIERA de las dos fuentes. El vistazo local responde en el acto y
  // la consulta real puede tardar; quedarse sólo con la primera dejaría el avatar vacío un
  // instante después de entrar desde el propio panel, que es justo cuando la persona está
  // mirando a ver si pasó algo.
  const signedIn = Boolean(account.userId) || peek.hasSession === true;
  const name = account.profile?.displayName ?? null;
  const initial = avatarInitial(name, peek.initial);
  const isStaff = Boolean(staff.session);

  // El rol cuesta un viaje y se pide al abrir el menú, así que «Panel del equipo» entraba
  // un segundo DESPUÉS y empujaba hacia abajo la fila que la persona iba a tocar. Se
  // recuerda si esta cuenta era del equipo la última vez —un sí o un no, nada más— y sólo
  // entonces se reserva el hueco. A quien nunca lo fue no le aparece una fila fantasma.
  const [wasStaff] = useState(() => {
    try {
      return window.localStorage.getItem(STAFF_HINT) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!staff.checked) return;
    try {
      if (staff.session) window.localStorage.setItem(STAFF_HINT, "1");
      else window.localStorage.removeItem(STAFF_HINT);
    } catch {
      /* modo privado: sin pista, el menú sólo pierde el hueco reservado */
    }
  }, [staff.checked, staff.session]);
  const staffPending = signedIn && !staff.checked && wasStaff;
  const savedCount = account.favourites.size;
  const hasCookies = Boolean(site.integrations.analytics.ga);

  const pick = useCallback(
    (run: () => void) => () => {
      onOpenChange(false);
      run();
    },
    [onOpenChange],
  );

  // El avatar va dentro del envoltorio: tocarlo con el menú abierto lo cierra. Antes lo
  // tapaba el fondo transparente que cerraba el menú, y el gesto no hacía nada.
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useDismiss(open, close, ref);

  // Lo que vale igual con o sin sesión: el idioma, la ayuda y lo legal.
  const general = (
    <div className="usermenu-list">
      {available.length > 1 ? (
        // Un control segmentado y no otro desplegable dentro del desplegable: son dos o tres
        // opciones, caben a la vista y se cambian de un toque. Es el mismo control que las
        // pestañas del panel — pista hundida y pastilla blanca para lo elegido.
        <div className="userlang" role="group" aria-label={t("account.language")}>
          <span className="userlang-label" aria-hidden="true">
            {t("account.language")}
          </span>
          <div className="userlang-seg">
            {available.map((l) => (
              <button
                key={l}
                type="button"
                role="menuitemradio"
                aria-checked={l === lang}
                aria-label={LANG_NAME[l]}
                title={LANG_NAME[l]}
                className={`userlang-opt${l === lang ? " userlang-on" : ""}`}
                onClick={() => setLang(l)}
              >
                <span className="lg-flag">{FLAG_ICON[l]}</span>
                <span aria-hidden="true">{l.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button type="button" className="useritem" role="menuitem" data-tour="help" onClick={pick(onHelp)}>
        <span className="useritem-ic">
          <Icon.question />
        </span>
        <span className="useritem-txt">{t("map.help")}</span>
      </button>

      <Link
        className="useritem"
        role="menuitem"
        href="/docs/privacidad"
        onClick={() => onOpenChange(false)}
      >
        <span className="useritem-ic">
          <Icon.shield />
        </span>
        <span className="useritem-txt">{t("footer.privacy")}</span>
      </Link>

      {hasCookies ? (
        <button type="button" className="useritem" role="menuitem" onClick={pick(openConsent)}>
          <span className="useritem-ic">
            <Icon.cookie />
          </span>
          <span className="useritem-txt">{t("footer.cookies")}</span>
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="userwrap" ref={ref}>
      {open ? (
        <div className="usermenu" role="menu" aria-label={t("account.title")} data-tour="usermenu">
          {signedIn ? (
            <>
              {/* La ficha de arriba ES el enlace a la cuenta, como en cualquier mapa: no
                  saluda, dice quién eres y cuántos puntos llevas guardados. Un recuento se
                  puede comprobar; "bienvenido" no informa de nada. */}
              <button type="button" className="userhead" role="menuitem" onClick={pick(onOpenAccount)}>
                <span className="avatar avatar-lg avatar-signed" aria-hidden="true">
                  {initial ?? <Icon.user />}
                </span>
                <span className="userhead-txt">
                  <b className="userhead-name">{name ?? t("account.noName")}</b>
                  <span className="userhead-sub">
                    {isStaff || staffPending ? t("account.roleStaff") : savedLabel(t, savedCount)}
                  </span>
                </span>
                <Icon.chevron className="userhead-ch" />
              </button>

              {(managesInitiative && onOpenInitiative) || isStaff || staffPending ? (
                <div className="usermenu-list">
                  {managesInitiative && onOpenInitiative ? (
                    <button
                      type="button"
                      className="useritem"
                      role="menuitem"
                      onClick={pick(onOpenInitiative)}
                    >
                      <span className="useritem-ic">
                        <Icon.spark />
                      </span>
                      <span className="useritem-txt">{t("mine.kicker")}</span>
                    </button>
                  ) : null}

                  {staffPending ? (
                    <div className="useritem useritem-skel" aria-hidden="true">
                      <span className="skel useritem-skel-ic" />
                      <span className="skel useritem-skel-txt" />
                    </div>
                  ) : isStaff ? (
                    <button
                      type="button"
                      className={`useritem${panelOpen ? " useritem-on" : ""}`}
                      role="menuitem"
                      aria-current={panelOpen ? "page" : undefined}
                      onClick={pick(onOpenPanel)}
                    >
                      <span className="useritem-ic">
                        <Icon.sliders />
                      </span>
                      <span className="useritem-txt">{t("admin.title")}</span>
                      {pending > 0 ? <span className="useritem-n useritem-alert">{pending}</span> : null}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {general}

              <div className="usermenu-list">
                <button
                  type="button"
                  className="useritem useritem-mut"
                  role="menuitem"
                  onClick={pick(onSignOut)}
                >
                  <span className="useritem-ic">
                    <Icon.logout />
                  </span>
                  <span className="useritem-txt">{t("account.signOut")}</span>
                </button>
              </div>
            </>
          ) : (
            /* Sin sesión el menú no lista funciones que no se pueden usar: dice para qué
               sirve una cuenta EN ESTE mapa y ofrece las dos puertas. */
            <>
              <div className="userhead userhead-anon">
                <span className="avatar avatar-lg" aria-hidden="true">
                  <Icon.user />
                </span>
                <span className="userhead-txt">
                  <b className="userhead-name">{t("account.anonTitle")}</b>
                  <span className="userhead-sub">{t("account.anonSub")}</span>
                </span>
              </div>

              <div className="usermenu-list">
                <button type="button" className="useritem" role="menuitem" onClick={pick(onOpenAccount)}>
                  <span className="useritem-ic">
                    <Icon.user />
                  </span>
                  <span className="useritem-txt">{t("account.signIn")}</span>
                </button>
                <Link
                  className="useritem"
                  role="menuitem"
                  href="/registro"
                  onClick={() => onOpenChange(false)}
                >
                  <span className="useritem-ic">
                    <Icon.plus />
                  </span>
                  <span className="useritem-txt">{t("account.createAccount")}</span>
                </Link>
              </div>

              {general}
            </>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className={`avatar avatar-btn${signedIn ? " avatar-signed" : ""}${open ? " avatar-on" : ""}`}
        data-tour="staffgear"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account.title")}
        title={t("account.title")}
        onClick={() => onOpenChange(!open)}
      >
        {signedIn && initial ? initial : <Icon.user />}
        {isStaff && pending > 0 ? <span className="gear-badge">{pending}</span> : null}
      </button>
    </div>
  );
}
