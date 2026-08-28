"use client";

import { useCallback } from "react";
import { useI18n } from "@/i18n/context";
import { Button, Notice, Spinner } from "@/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";
import LoginForm from "@/features/admin/LoginForm";
import { useAccount } from "@/features/account/useAccount";

/**
 * Lo que ve, detrás del candado, quien NO es del equipo.
 *
 * Este componente existe por un fallo concreto y repetido: hasta ahora el candado sólo
 * sabía dos cosas, "eres del equipo" y "no lo eres", y trataba la segunda como si fuera
 * "no has entrado". Una persona con cuenta recién confirmada tocaba el candado y le salía
 * otra vez el formulario de acceso, sin un solo mensaje que explicara por qué.
 *
 * Ahora hay tres estados y cada uno dice lo suyo:
 *
 *   sin sesión           → el formulario de acceso, como siempre
 *   con sesión, sin rol  → su nombre, qué PUEDE hacer, y por dónde
 *   con sesión y rol     → no llega acá; `AppShell` muestra el panel del equipo
 *
 * El del medio es el que faltaba, y es el que más gente va a ver.
 */
export default function AccountPanel({
  onSignedIn,
  onOpenAccount,
  onVolunteer,
}: {
  onSignedIn: () => void;
  onOpenAccount: () => void;
  onVolunteer: () => void;
}) {
  const { t } = useI18n();
  const account = useAccount(true);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    await sb?.auth.signOut();
    window.location.reload();
  }, []);

  if (!account.checked) return <Spinner />;

  // Sin sesión: el camino de siempre. `LoginForm` ya lleva debajo el enlace a /registro.
  if (!account.userId) return <LoginForm onSignedIn={onSignedIn} />;

  // Con sesión y sin rol de equipo. Lo importante acá no es el saludo: es que la persona
  // entienda que SÍ entró, que su cuenta sirve para algo, y que el panel del equipo no es
  // un sitio al que le falte una contraseña sino uno para el que hace falta que la
  // aprueben.
  const name = account.profile?.displayName;

  return (
    <div className="form">
      <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
        {name ? t("account.hello", { name }) : t("account.title")}
      </h2>

      <Notice tone="info">{t("account.panelIntro")}</Notice>

      {/* Botones y no enlaces: los dos destinos son vistas de esta misma aplicación, y
          navegar a ellas tiraba abajo el mapa para volver a montarlo igual. */}
      <button type="button" className="linkbtn" onClick={onOpenAccount}>
        {t("account.open")}
      </button>

      <button type="button" className="linkbtn" onClick={onVolunteer}>
        {t("account.volApply")}
      </button>

      <Button type="button" onClick={signOut} block>
        {t("account.signOut")}
      </Button>
    </div>
  );
}
