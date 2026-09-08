"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import RegisterForm from "@/features/account/RegisterForm";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import "../inicio/entry.css";
import "../auth.css";
import { Icon } from "@/ui/icons";

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
 * Reusa el frente oscuro de `/inicio` importando su hoja tal cual. Antes esta pantalla
 * era un formulario en blanco pegado al canto, sin logo y sin nombre: quien llegaba desde
 * el enlace de un correo no tenía forma de saber en qué sitio estaba metiendo su
 * contraseña, que es exactamente la pregunta que hay que responder ahí.
 *
 * El logo es lo primero y es también el enlace de vuelta al mapa, así que la salida deja
 * de estar escondida al final de la página.
 */
export default function RegisterPage() {
  const site = useSite();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <main className="entry auth">
      <div className="entry-card">
        <header className="entry-head">
          <Link className="entry-logo" href="/" aria-label={site.brand.name}>
            {site.brand.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- un asset estático
              <img src={site.brand.logo} alt="" />
            ) : (
              site.brand.emoji || site.country.code.slice(0, 1)
            )}
          </Link>
          <div className="entry-brand">{site.country.host}</div>
          <h1 className="entry-h1">{t("register.title")}</h1>
          <p className="entry-lead">{t("register.subtitle")}</p>
        </header>

        <div className="auth-card">
          <RegisterForm onSignIn={() => router.push("/login")} />
        </div>

        <nav className="auth-legal">
          <Link href="/docs/privacidad">{t("footer.privacy")}</Link>
          <Link href="/docs/terminos">{t("footer.terms")}</Link>
        </nav>

        <p className="auth-foot">
          <Link className="auth-back" href="/">
            <Icon.back />
            {t("register.backToMap", { name: site.brand.name })}
          </Link>
        </p>
      </div>
    </main>
  );
}
