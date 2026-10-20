"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import { faunaOf } from "@/domain/avatar";
import type { AccountState } from "@/features/account/useAccount";
import AvatarSettings from "@/features/avatar/AvatarSettings";
import PasswordChange from "@/features/admin/PasswordChange";

/**
 * Configuración: lo que se CAMBIA de la cuenta. «Mi cuenta» es para ver de un vistazo lo
 * que llevas —tu avatar con su nivel, tus puntos, lo que enviaste—; editar va aquí, detrás
 * de una entrada propia del menú del avatar, para que esa pantalla no se llene de
 * formularios.
 *
 * Hoy: el avatar (el mismo creador del registro) y la contraseña.
 */
export default function SettingsView({ account }: { account: AccountState }) {
  const { t } = useI18n();
  const site = useSite();
  const hasAvatar = useMemo(() => faunaOf(site.country).length > 0, [site.country]);

  return (
    <div className="acc">
      {hasAvatar && account.userId ? (
        <section className="acc-sec">
          <h3 className="acc-h">{t("avatar.yours")}</h3>
          <AvatarSettings account={account} />
        </section>
      ) : null}

      {/* Vivía en «Mi cuenta». La ruta (`/api/account/password`) sirve a cualquier cuenta. */}
      <section className="acc-sec">
        <h3 className="acc-h">{t("account.security")}</h3>
        <PasswordChange toggleClassName="acc-cta" />
      </section>
    </div>
  );
}
