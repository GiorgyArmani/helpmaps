"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import type { StaffState } from "@/features/admin/useStaffSession";
import type { AccountState } from "@/features/account/useAccount";
import { avatarInitial, useSessionPeek } from "@/features/account/useSessionPeek";
import { savedLabel } from "@/features/account/ledger";

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
  onOpenVolunteer,
  onSignOut,
  volunteerEnabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountState;
  staff: StaffState;
  pending: number;
  onOpenAccount: () => void;
  onOpenPanel: () => void;
  onOpenVolunteer: () => void;
  onSignOut: () => void;
  volunteerEnabled: boolean;
}) {
  const { t } = useI18n();
  const peek = useSessionPeek();

  // Con sesión según CUALQUIERA de las dos fuentes. El vistazo local responde en el acto y
  // la consulta real puede tardar; quedarse sólo con la primera dejaría el avatar vacío un
  // instante después de entrar desde el propio panel, que es justo cuando la persona está
  // mirando a ver si pasó algo.
  const signedIn = Boolean(account.userId) || peek.hasSession === true;
  const name = account.profile?.displayName ?? null;
  const initial = avatarInitial(name, peek.initial);
  const isStaff = Boolean(staff.session);
  const savedCount = account.favourites.size;

  const pick = useCallback(
    (run: () => void) => () => {
      onOpenChange(false);
      run();
    },
    [onOpenChange],
  );

  return (
    <div className="userwrap">
      {open ? (
        <>
          <button
            type="button"
            className="fab-backdrop"
            aria-label={t("common.close")}
            onClick={() => onOpenChange(false)}
          />
          <div className="usermenu" role="menu" aria-label={t("account.title")}>
            {signedIn ? (
              <>
                {/* La ficha de arriba ES el enlace a la cuenta, como en cualquier mapa: no
                    saluda, dice quién eres y cuántos puntos llevas guardados. Un recuento
                    se puede comprobar; "bienvenido" no informa de nada. */}
                <button type="button" className="userhead" role="menuitem" onClick={pick(onOpenAccount)}>
                  <span className="avatar avatar-lg avatar-signed" aria-hidden="true">
                    {initial ?? <Icon.user />}
                  </span>
                  <span className="userhead-txt">
                    <b className="userhead-name">{name ?? t("account.noName")}</b>
                    <span className="userhead-sub">
                      {isStaff ? t("account.roleStaff") : savedLabel(t, savedCount)}
                    </span>
                  </span>
                  <Icon.chevron className="userhead-ch" />
                </button>

                <div className="usermenu-list">
                  <button type="button" className="useritem" role="menuitem" onClick={pick(onOpenAccount)}>
                    <span className="useritem-ic">
                      <Icon.heart />
                    </span>
                    <span className="useritem-txt">{t("account.saved.title")}</span>
                    {savedCount > 0 ? <span className="useritem-n">{savedCount}</span> : null}
                  </button>

                  {isStaff ? (
                    <button type="button" className="useritem" role="menuitem" onClick={pick(onOpenPanel)}>
                      <span className="useritem-ic">
                        <Icon.sliders />
                      </span>
                      <span className="useritem-txt">{t("admin.title")}</span>
                      {pending > 0 ? <span className="useritem-n useritem-alert">{pending}</span> : null}
                    </button>
                  ) : volunteerEnabled ? (
                    <button type="button" className="useritem" role="menuitem" onClick={pick(onOpenVolunteer)}>
                      <span className="useritem-ic">
                        <Icon.hand />
                      </span>
                      <span className="useritem-txt">{t("account.volunteer")}</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="useritem useritem-quiet"
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
              </>
            )}
          </div>
        </>
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
