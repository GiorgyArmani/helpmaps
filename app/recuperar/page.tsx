"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ResetRequestForm from "@/features/account/ResetRequestForm";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import "../inicio/entry.css";
import "../auth.css";

/**
 * «Olvidé mi contraseña» — pedir el enlace.
 *
 * Es la tercera pantalla de la familia de acceso y comparte su frente con `/login` y
 * `/registro`: quien llega aquí viene de no poder entrar, y una pantalla desconocida en
 * ese momento se lee como que se equivocó de sitio.
 *
 * `/reset` es la OTRA mitad y ya existía: allí aterriza el enlace de este correo y se
 * elige la contraseña. Lo que faltaba era esto, la puerta para pedirlo.
 */
export default function RecoverPage() {
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
          <h1 className="entry-h1">{t("forgot.title")}</h1>
          <p className="entry-lead">{t("forgot.subtitle")}</p>
        </header>

        <div className="auth-card">
          <ResetRequestForm onBack={() => router.push("/login")} />
        </div>

        <p className="auth-foot">
          <Link className="auth-back" href="/">
            ← {t("register.backToMap", { name: site.brand.name })}
          </Link>
        </p>
      </div>
    </main>
  );
}
