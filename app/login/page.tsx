"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import LoginForm from "@/features/admin/LoginForm";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import { Suspense } from "react";
import "../inicio/entry.css";
import "../auth.css";

/**
 * Team sign-in as a standalone page.
 *
 * The everyday way in is the avatar in the header, which opens the panel — and this form
 * when there is no session — straight over the map, without leaving it. This page stays
 * for the links that already exist (bookmarks, the volunteer welcome email) and hands
 * over to the map view as soon as the sign-in succeeds.
 *
 * The form itself is the shared component, so there is one sign-in to keep correct.
 *
 * El aspecto es el mismo que el de `/registro`, y por la misma razón: son las dos
 * pantallas a las que se llega desde un enlace de correo, y una pantalla que pide una
 * contraseña tiene que decir de quién es antes de pedirla. Ver `app/auth.css`.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginBody />
    </Suspense>
  );
}

/**
 * A dónde ir tras entrar.
 *
 * Sólo rutas de ESTE sitio: una que empiece por `//` o por un esquema es una redirección
 * abierta, y una pantalla de acceso que manda a donde le digan es la pieza con la que se
 * monta un phishing convincente — el dominio de la barra es el bueno hasta el segundo
 * antes de dejar de serlo.
 */
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function LoginBody() {
  const site = useSite();
  const { t } = useI18n();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

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
          <h1 className="entry-h1">{t("login.title")}</h1>
        </header>

        <div className="auth-card">
          <LoginForm onSignedIn={() => router.replace(next ?? "/?panel=1")} />
        </div>

        {/* Sin «¿no tienes cuenta?» aquí: `LoginForm` ya lo trae, porque también se usa
            dentro del panel del mapa, donde no hay página que lo ponga. Repetirlo salían
            dos veces seguidas. */}
        <p className="auth-foot">
          <Link className="auth-back" href="/">
            ← {t("register.backToMap", { name: site.brand.name })}
          </Link>
        </p>
      </div>
    </main>
  );
}
