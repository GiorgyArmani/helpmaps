"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { MIN_PASSWORD_PUBLIC, publicPasswordTooShort } from "@/lib/password";
import { Button, Field, Input, Notice, Spinner } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import { rememberResetEmail } from "@/features/account/resetHandoff";
import "../inicio/entry.css";
import "../auth.css";
import { Icon } from "@/ui/icons";

type Phase = "checking" | "code" | "ready" | "done";

/**
 * Elegir una contraseña nueva.
 *
 * ── DOS FORMAS DE LLEGAR, Y LA SEGUNDA ES LA QUE FUNCIONA ───────────────────
 *
 * 1. CON UN CÓDIGO, que es el camino normal desde que existe `/recuperar`. La persona
 *    escribe el código de ocho dígitos que le llegó por correo y se canjea aquí con
 *    `verifyOtp`.
 *
 * 2. CON UNA SESIÓN YA PUESTA, que es como llega un enlace de invitación del equipo.
 *    Seguir ese enlace establece la sesión y esta página sólo la gasta.
 *
 * El camino 1 existe porque el 2 se rompía solo: el enlace es de un solo uso y lo quema
 * cualquier GET, incluidos los escáneres de seguridad de Gmail y Outlook, que abren todos
 * los enlaces de todos los correos antes de que nadie los toque. Medido contra este
 * proyecto: un acceso al enlace y el siguiente ya responde `access_denied`. Ver
 * `src/lib/email.ts` → `sendPasswordReset`.
 *
 * Por eso, cuando no hay sesión, esto NO dice «enlace caducado» y se acaba: pide el
 * código, que es algo que la persona sí tiene en la mano.
 *
 * ── LA SESIÓN QUE PUEDE VENIR EN LA URL ─────────────────────────────────────
 *
 * Aún se aceptan las dos formas en que Supabase puede devolverla, porque cuál llega
 * depende de un ajuste del proyecto que esta página no controla:
 *
 *   • `?code=…`  — PKCE. Se intercambia por una sesión.
 *   • `#access_token=…` — implícito. El cliente lo consume al construirse
 *     (`detectSessionInUrl`), así que la sesión puede existir antes de que esto corra.
 */
export default function ResetPasswordPage() {
  const site = useSite();
  const { t } = useI18n();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lo del canje por código.
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    const sb = getSupabase();
    let cancelled = false;

    // Una sesión que llega del fragmento puede aterrizar después de este efecto.
    const sub = sb?.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setPhase("ready");
    });

    // Todos los cambios de estado ocurren tras un await, así que esto nunca encadena
    // renders como avisa la regla.
    void (async () => {
      // El correo que se escribió en `/recuperar`, si fue en este mismo navegador.
      // Ahorra teclearlo de nuevo mientras se copian ocho dígitos de otra ventana, que
      // es donde la gente abandona. No viaja en la URL a propósito: una dirección en la
      // barra acaba en los registros de cualquier proxy por el que pase.
      const guardado = rememberResetEmail.read();

      if (!sb) {
        if (cancelled) return;
        if (guardado) setEmail(guardado);
        setPhase("code");
        return;
      }
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeErr } = await sb.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (!exchangeErr) {
          setPhase("ready");
          return;
        }
      }
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      // Sin sesión NO es un callejón: se pide el código.
      if (!data.session && guardado) setEmail(guardado);
      setPhase(data.session ? "ready" : "code");
    })();

    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  /** Canjear el código por una sesión de recuperación. */
  const redeem = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const sb = getSupabase();
      if (!sb || busy) return;
      setBusy(true);
      setError(null);
      try {
        const { error: err } = await sb.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: otp.replace(/\s+/g, ""),
          type: "recovery",
        });
        if (err) {
          setError(t("reset.badCode"));
          return;
        }
        setPhase("ready");
      } catch {
        setError(t("error.network"));
      } finally {
        setBusy(false);
      }
    },
    [email, otp, busy, t],
  );

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (publicPasswordTooShort(password) || password !== confirm || busy) return;
      setBusy(true);
      setError(null);
      try {
        // La ruta única de contraseña: sirve a cualquier cuenta y sube el listón a 12
        // por su cuenta si resulta ser del equipo. Antes esto llamaba a la de staff, que
        // respondía 403 a todo el que no lo fuera — o sea, a casi todo el mundo.
        const res = await fetch("/api/account/password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data: { error?: string; min?: number } = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            data.error === "pwned_password"
              ? t("password.pwned")
              // El `min` viene del servidor: sólo él sabe si esta cuenta es del equipo, y
              // un voluntario tiene que leer 12 y no 8.
              : data.error === "password_too_short"
                ? t("password.tooShort", { n: data.min ?? MIN_PASSWORD_PUBLIC })
                : t("admin.saveError"),
          );
          return;
        }
        rememberResetEmail.clear();
        setPhase("done");
        // Al mapa, ya con la sesión puesta. Antes iba directo al panel del equipo, que
        // para quien sólo guarda refugios es una puerta que no le abre.
        window.setTimeout(() => router.replace("/"), 1200);
      } catch {
        setError(t("error.network"));
      } finally {
        setBusy(false);
      }
    },
    [password, confirm, busy, t, router],
  );

  const tooShort = password.length > 0 && publicPasswordTooShort(password);
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = !publicPasswordTooShort(password) && password === confirm && !busy;
  const canRedeem = !busy && email.includes("@") && otp.replace(/\s+/g, "").length >= 6;

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
          <h1 className="entry-h1">{t("reset.title")}</h1>
          <p className="entry-lead">
            {phase === "code" ? t("reset.codeSubtitle") : t("reset.subtitle")}
          </p>
        </header>

        <div className="auth-card">
          {phase === "checking" ? <Spinner /> : null}

          {phase === "done" ? <Notice tone="info">{t("reset.done")}</Notice> : null}

          {phase === "code" ? (
            <form className="form" onSubmit={redeem}>
              <Field label={t("register.email")}>
                <Input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label={t("reset.codeLabel")} hint={t("reset.codeHint")}>
                <Input
                  required
                  autoFocus
                  // `inputMode` y no `type="number"`: el código puede empezar por cero y
                  // un campo numérico se los come, además de traer flechitas que aquí
                  // no significan nada.
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="inp-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </Field>

              {error ? <Notice tone="danger">{error}</Notice> : null}

              <Button type="submit" loading={busy} disabled={!canRedeem} block>
                {busy ? t("common.loading") : t("reset.codeSubmit")}
              </Button>

              <p className="small mut" style={{ margin: 0 }}>
                <Link className="linkish" href="/recuperar">
                  {t("reset.resend")}
                </Link>
              </p>
            </form>
          ) : null}

          {phase === "ready" ? (
            <form className="form" onSubmit={submit}>
              <Field label={t("password.new")} hint={t("password.hint", { n: MIN_PASSWORD_PUBLIC })}>
                <Input
                  required
                  autoFocus
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label={t("password.confirm")}>
                <Input
                  required
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>

              {tooShort ? (
                <p className="lerr">{t("password.tooShort", { n: MIN_PASSWORD_PUBLIC })}</p>
              ) : null}
              {mismatch ? <p className="lerr">{t("password.mismatch")}</p> : null}
              {error ? <Notice tone="danger">{error}</Notice> : null}

              <Button type="submit" loading={busy} disabled={!canSubmit} block>
                {busy ? t("common.saving") : t("reset.submit")}
              </Button>
            </form>
          ) : null}
        </div>

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
