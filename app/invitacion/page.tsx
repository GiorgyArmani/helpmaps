"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { acceptInvite } from "@/data/initiatives";
import { Button, Field, Input, Notice } from "@/ui/primitives";
import { MIN_PASSWORD_PUBLIC, publicPasswordTooShort } from "@/lib/password";
import { cleanDisplayName, displayNameInvalid } from "@/domain/account";
import { clearPendingInvite, savePendingInvite } from "@/features/account/pendingInvite";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import "../inicio/entry.css";
import "../auth.css";
import { Icon } from "@/ui/icons";

type Phase =
  | "checking"
  | "create"
  | "needsAccount"
  | "ready"
  | "working"
  | "done"
  | "failed";

interface InviteInfo {
  place?: string;
  email?: string | null;
  error?: string;
}

/** Los fallos de la invitación que tienen su propio mensaje. */
type DeadInvite = "used" | "expired" | "not_found";
function isDead(code: string | undefined): code is DeadInvite {
  return code === "used" || code === "expired" || code === "not_found";
}

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
 * Si la invitación nombra un correo, la cuenta se crea AQUÍ MISMO: nombre y contraseña,
 * el correo ya viene puesto, y de ahí directo al onboarding de su punto. Sin segundo
 * correo de confirmación — el token llegó a esa dirección, y eso ya la prueba. Ver
 * `app/api/account/invite/route.ts`.
 *
 * Antes se mandaba a `/registro`, que perdía el `next` y cuyo enlace de confirmación
 * aterrizaba en el mapa: quien venía a gestionar su iniciativa acababa en el flujo de una
 * persona cualquiera. Eso pasó con una invitación real.
 *
 * Si la invitación NO tiene correo (viajó por WhatsApp), sigue el registro normal, con el
 * token en el `next` y guardado en el navegador (`pendingInvite.ts`) para rescatarlo
 * aunque Supabase descarte el destino del enlace de confirmación.
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
  const [place, setPlace] = useState("");
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    let cancelled = false;
    if (!token) return;
    void (async () => {
      if (!sb) {
        if (!cancelled) setPhase("failed");
        return;
      }
      // La sesión y la invitación a la vez: son dos viajes independientes, y en una
      // conexión mala cada viaje en serie es un segundo más de esqueleto.
      const [{ data }, info] = await Promise.all([
        sb.auth.getSession(),
        fetch(`/api/account/invite?t=${encodeURIComponent(token)}`)
          .then(async (r) => ({
            ok: r.ok,
            body: (await r.json().catch(() => ({}))) as InviteInfo,
          }))
          .catch(() => ({ ok: false, body: {} as InviteInfo })),
      ]);
      if (cancelled) return;

      if (info.ok) {
        setPlace(info.body.place ?? "");
        setInviteEmail(info.body.email ?? null);
      } else if (isDead(info.body.error)) {
        // Una invitación gastada no se acepta con cuenta ni sin ella: decirlo ya, antes
        // de pedirle a nadie que cree una cuenta para nada.
        clearPendingInvite();
        setError(t(`invite.${info.body.error}`));
        setPhase("failed");
        return;
      }

      if (data.session) {
        setPhase("ready");
        return;
      }
      // Se guarda por si la persona se va a `/registro` o a `/login`: vuelva por donde
      // vuelva, la invitación la espera. Ver `pendingInvite.ts`.
      savePendingInvite(token);
      setPhase(info.ok && info.body.email ? "create" : "needsAccount");
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
      clearPendingInvite();
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

  // El token viaja en el `next` para que volver aquí sea automático.
  const next = `/invitacion?t=${token}`;
  const loginHref = `/login?next=${encodeURIComponent(next)}`;

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
          <p className="entry-lead">
            {place ? t("invite.subtitlePlace", { place }) : t("invite.subtitle")}
          </p>
        </header>

        <div className="auth-card" aria-busy={phase === "checking"}>
          {phase === "checking" ? (
            // El hueco del formulario que viene, no una ruleta: cuando llega ocupa el
            // mismo sitio y no empuja nada.
            <div className="form" aria-hidden="true">
              <div className="skel skel-line" />
              <div className="skel skel-line skel-line-short" />
              <div className="skel skel-field" />
              <div className="skel skel-field" />
              <div className="skel skel-field" />
            </div>
          ) : null}

          {phase === "create" && inviteEmail ? (
            <CreateAndAccept
              token={token}
              email={inviteEmail}
              loginHref={loginHref}
              onAccountReady={() => void accept()}
            />
          ) : null}

          {phase === "needsAccount" ? (
            <div className="form">
              <p className="small mut" style={{ margin: 0 }}>
                {t("invite.needsAccount")}
              </p>
              <Link className="btnp" href={`/registro?next=${encodeURIComponent(next)}`}>
                {t("register.title")}
              </Link>
              <Link className="btng" href={loginHref}>
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
            <Icon.back />
            {t("register.backToMap", { name: site.brand.name })}
          </Link>
        </p>
      </div>
    </main>
  );
}

/**
 * Crear la cuenta sin salir de la invitación.
 *
 * Dos campos, no tres: el correo lo pone la invitación y se enseña de sólo lectura, para
 * que la persona sepa con qué dirección entrará después sin poder cambiarla — otra
 * dirección ya no estaría probada por el token.
 *
 * Al terminar entra con esa contraseña y canjea en el mismo gesto: un solo botón entre
 * abrir el correo y estar dentro de su punto.
 */
function CreateAndAccept({
  token,
  email,
  loginHref,
  onAccountReady,
}: {
  token: string;
  email: string;
  loginHref: string;
  onAccountReady: () => void;
}) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);

  const nameBad = displayName.length > 0 && displayNameInvalid(cleanDisplayName(displayName));
  const passBad = password.length > 0 && publicPasswordTooShort(password);
  const canSubmit =
    !busy &&
    !displayNameInvalid(cleanDisplayName(displayName)) &&
    !publicPasswordTooShort(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, displayName: cleanDisplayName(displayName), password }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "exists") {
          setExists(true);
          return;
        }
        setError(
          data.error === "pwned_password"
            ? t("password.pwned")
            : data.error === "password_too_short"
              ? t("password.tooShort", { n: MIN_PASSWORD_PUBLIC })
              : data.error === "invalid_display_name"
                ? t("register.errorName")
                : isDead(data.error)
                  ? t(`invite.${data.error}`)
                  : t("admin.saveError"),
        );
        return;
      }
      // La cuenta ya existe y está confirmada: entrar y canjear, sin pasar por ningún
      // correo más.
      const { error: signInError } = await sb.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      onAccountReady();
    } catch {
      setError(t("error.network"));
    } finally {
      setBusy(false);
    }
  };

  if (exists) {
    return (
      <div className="form">
        <Notice tone="info">{t("invite.exists")}</Notice>
        <Link className="btnp" href={loginHref}>
          {t("account.signIn")}
        </Link>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={(e) => void submit(e)}>
      <p className="small mut" style={{ margin: 0 }}>
        {t("invite.createLead")}
      </p>

      <Field label={t("register.email")} hint={t("invite.emailFixed")}>
        <Input type="email" value={email} readOnly autoComplete="username" />
      </Field>

      <Field label={t("register.displayName")} hint={t("register.displayNameHint")}>
        <Input
          required
          autoFocus
          autoComplete="nickname"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </Field>
      {nameBad ? <p className="lerr">{t("register.errorName")}</p> : null}

      <Field label={t("register.password")} hint={t("password.hint", { n: MIN_PASSWORD_PUBLIC })}>
        <Input
          required
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {passBad ? (
        <p className="lerr">{t("password.tooShort", { n: MIN_PASSWORD_PUBLIC })}</p>
      ) : null}

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Button type="submit" loading={busy} disabled={!canSubmit} block>
        {busy ? t("register.submitting") : t("invite.createSubmit")}
      </Button>

      <p className="small mut" style={{ margin: 0 }}>
        {t("register.haveAccount")}{" "}
        <Link className="linkish" href={loginHref}>
          {t("account.signIn")}
        </Link>
      </p>
    </form>
  );
}
