"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { acceptInvite } from "@/data/initiatives";
import { Button, Notice, Spinner } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import "../inicio/entry.css";
import "../auth.css";

type Phase = "checking" | "needsAccount" | "ready" | "working" | "done" | "failed";

/**
 * Aceptar una invitación a gestionar un punto.
 *
 * ── EL TOKEN NO SE CANJEA SOLO ──────────────────────────────────────────────
 *
 * Llegar aquí no acepta nada: hay un botón. Y no es ceremonia — es lo que hace que el
 * enlace se pueda mandar por WhatsApp sin miedo. Cualquier vista previa que abra la URL
 * (WhatsApp la abre para sacar el título, y los escáneres de correo también) hace un GET
 * y nada más. El canje es una llamada autenticada a `accept_center_invite`, que exige
 * `auth.uid()`: sin sesión no hay nada que gastar.
 *
 * Ésa es justo la diferencia con el enlace de recuperación de Supabase, que sí se quema
 * al visitarlo — ver `src/lib/email.ts` → `sendPasswordReset`.
 *
 * ── SI NO TIENE CUENTA ──────────────────────────────────────────────────────
 *
 * La invitación se guarda y se manda a crear cuenta. Al volver, el token sigue donde
 * estaba. Pedirle que se registre y luego perder la invitación por el camino sería la
 * forma más rápida de perder a la persona.
 */
export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteBody />
    </Suspense>
  );
}

function InviteBody() {
  const site = useSite();
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("t") ?? "";

  // Sin token no hay nada que comprobar, y eso se sabe en el primer render: el estado
  // arranca ya en «falló» en vez de arrancar en «comprobando» y corregirse desde un
  // efecto, que encadena un render y enseña un momento de carga que no existe.
  const [phase, setPhase] = useState<Phase>(() => (token ? "checking" : "failed"));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    let cancelled = false;
    if (!token) return;
    void (async () => {
      if (!sb) {
        if (!cancelled) setPhase("failed");
        return;
      }
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      setPhase(data.session ? "ready" : "needsAccount");
    })();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const accept = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setPhase("working");
    setError(null);
    try {
      await acceptInvite(sb, token);
      setPhase("done");
      // Directo a «Tu iniciativa», que abre en el onboarding. Ese es el momento en que
      // la persona tiene toda la información en la cabeza; mandarla al mapa a buscar la
      // entrada del menú sería tirarlo.
      window.setTimeout(() => router.replace("/?mine=1"), 1200);
    } catch (e) {
      // El mensaje viene de la función de la base y ya está escrito para una persona:
      // «esa invitación ya se usó», «caducó», «es para otra cuenta».
      setPhase("failed");
      setError(e instanceof Error ? e.message : t("error.generic"));
    }
  }, [token, router, t]);

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
          <h1 className="entry-h1">{t("invite.title")}</h1>
          <p className="entry-lead">{t("invite.subtitle")}</p>
        </header>

        <div className="auth-card">
          {phase === "checking" ? <Spinner /> : null}

          {phase === "needsAccount" ? (
            <div className="form">
              <p className="small mut" style={{ margin: 0 }}>
                {t("invite.needsAccount")}
              </p>
              {/* El token viaja en el `next` para que volver aquí sea automático. */}
              <Link
                className="btnp"
                href={`/registro?next=${encodeURIComponent(`/invitacion?t=${token}`)}`}
              >
                {t("register.title")}
              </Link>
              <Link
                className="btng"
                href={`/login?next=${encodeURIComponent(`/invitacion?t=${token}`)}`}
              >
                {t("account.signIn")}
              </Link>
            </div>
          ) : null}

          {phase === "ready" || phase === "working" ? (
            <div className="form">
              <p className="small mut" style={{ margin: 0 }}>
                {t("invite.body")}
              </p>
              <Button
                type="button"
                onClick={() => void accept()}
                loading={phase === "working"}
                disabled={phase === "working"}
                block
              >
                {phase === "working" ? t("common.loading") : t("invite.accept")}
              </Button>
            </div>
          ) : null}

          {phase === "done" ? <Notice tone="info">{t("invite.done")}</Notice> : null}

          {phase === "failed" ? (
            <Notice tone="danger">
              {error ?? (token ? t("error.generic") : t("invite.noToken"))}
            </Notice>
          ) : null}
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
