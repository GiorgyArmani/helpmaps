"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RegisterStepper, { type Purpose, type StepId } from "@/features/account/RegisterStepper";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";
import { useSite } from "@/features/app/SiteProvider";
import { Icon } from "@/ui/icons";
import { safeNext } from "@/lib/safeNext";
import LangSwitch from "@/ui/LangSwitch";
import "../organizaciones/orgs.css";
import "./registro.css";

/**
 * Crear una cuenta, como página propia.
 *
 * Página y no un panel sobre el mapa —al revés que el inicio de sesión del equipo— por
 * dos razones. La primera es que hay que poder enlazarla: desde el correo, desde un
 * mensaje, desde el formulario de voluntario. La segunda es que crear una cuenta no es
 * una tarea que se haga *mientras* se busca un refugio; el panel del equipo sí, y por eso
 * ése no navega.
 *
 * ── EL ASPECTO ──────────────────────────────────────────────────────────────
 *
 * El de las portadas (`/inicio`, `/organizaciones`): su barra con el logo —que dice en
 * qué sitio se está metiendo la contraseña, la pregunta que hay que responder aquí— y su
 * titular. No es «crear una cuenta» cualquiera: es la bienvenida a la plataforma, y lo
 * primero es preguntar cómo la quiere usar la persona. Desde ahí el recorrido
 * (`RegisterStepper`) y el titular de la página son los de su camino.
 *
 * Mientras se crea el personaje (avatar y nombre) el titular se esconde: el escenario es
 * lo único que importa en ese momento y en 390 px no caben los dos sin empujarlo hacia
 * abajo. Vuelve en cuanto empiezan las preguntas.
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterBody />
    </Suspense>
  );
}

function RegisterBody() {
  const site = useSite();
  const { t } = useI18n();
  const router = useRouter();
  // Quien llega desde una invitación trae su vuelta en el `next`; perderlo aquí era
  // perder la invitación.
  const next = safeNext(useSearchParams().get("next"));
  // El titular cambia con lo que la persona elige: la página pasa a hablarle a ella.
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const hero = purpose ?? "welcome";
  const [step, setStep] = useState<StepId | "done" | null>(null);
  // `null` mientras el recorrido no ha dicho dónde está: sin titular, para que no aparezca
  // y desaparezca en el primer instante.
  const creating = step === null || step === "avatar" || step === "name";

  return (
    <main className="olp rgp">
      <header className="olp-top">
        <Link href="/" className="olp-brand">
          <span className="olp-logo" aria-hidden="true">
            {site.brand.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- un asset estático
              <img src={site.brand.logo} alt="" />
            ) : (
              site.brand.emoji || site.country.code.slice(0, 1)
            )}
          </span>
          <span className="olp-brand-n">{site.brand.name}</span>
        </Link>
        <div className="olp-top-end">
          <LangSwitch />
          <Link href="/" className="olp-toplink">
            {t("orgs.toMap")}
            <Icon.chevron width={16} height={16} />
          </Link>
        </div>
      </header>

      <section className="rgp-in">
        {/* `key`: al cambiar de camino, el titular entra de nuevo. Mientras se crea el
            personaje, el titular es el del paso, dentro de la tarjeta. */}
        {creating ? (
          <h1 className="rgp-sr">{t("register.title")}</h1>
        ) : (
          <div key={hero} className="rgp-hero">
            <h1 className="olp-h1 rgp-h1">{t(`register.hero.${hero}.title` as DictKey, { platform: site.brand.platform })}</h1>
            <p className="olp-lead rgp-lead">{t(`register.hero.${hero}.lead` as DictKey, { platform: site.brand.platform })}</p>
          </div>
        )}

        <div className={creating ? "rgp-card rgp-card-stage" : "rgp-card"}>
          <RegisterStepper
            next={next}
            onPurpose={setPurpose}
            onStep={setStep}
            onSignIn={() => router.push(next ? `/login?next=${encodeURIComponent(next)}` : "/login")}
          />
        </div>

        <nav className="rgp-legal">
          <Link href="/docs/privacidad">{t("footer.privacy")}</Link>
          <Link href="/docs/terminos">{t("footer.terms")}</Link>
        </nav>
      </section>
    </main>
  );
}
