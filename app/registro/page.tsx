"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import RegisterForm from "@/features/account/RegisterForm";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";

/**
 * Crear una cuenta, como página propia.
 *
 * Página y no un panel sobre el mapa —al revés que el inicio de sesión del equipo— por
 * dos razones. La primera es que hay que poder enlazarla: desde el correo, desde un
 * mensaje, desde el formulario de voluntario. La segunda es que crear una cuenta no es
 * una tarea que se haga *mientras* se busca un refugio; el panel del equipo sí, y por eso
 * ése no navega.
 *
 * El enlace de vuelta al mapa está siempre, y sin cerrar nada: quien llegó acá por
 * curiosidad tiene que poder salir sin sentir que abandonó un trámite a medias.
 */
export default function RegisterPage() {
  const site = useSite();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <main className="loginwrap">
      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>{t("register.title")}</h1>
      </div>

      <RegisterForm onSignIn={() => router.push("/login")} />

      <Link className="linkbtn" href="/">
        ← {site.brand.name}
      </Link>
    </main>
  );
}
