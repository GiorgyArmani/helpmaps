"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/i18n/context";
import { Button, Field, Input, Notice } from "@/ui/primitives";
import { MIN_PASSWORD_PUBLIC, publicPasswordTooShort } from "@/lib/password";
import { cleanDisplayName, displayNameInvalid } from "@/domain/account";

/**
 * Crear una cuenta de persona.
 *
 * ── LO QUE ESTE FORMULARIO NO PIDE ──────────────────────────────────────────
 *
 * No pide teléfono, ni apellido, ni estado, ni "cuéntanos sobre ti". Tres campos, y los
 * tres hacen falta para que la cuenta exista. Todo lo demás se pregunta cuando hay una
 * razón concreta — el estado, por ejemplo, se pregunta al postularse al equipo, que es
 * cuando un admin necesita saber a qué zona corresponde.
 *
 * En un mapa de emergencia venezolano, cada campo de más es un dato que hay que custodiar
 * y que puede filtrarse. La forma más barata de proteger algo es no tenerlo.
 *
 * ── POR QUÉ EL "ÉXITO" NO DICE SI LA CUENTA SE CREÓ ─────────────────────────
 *
 * El mensaje final dice "si esa dirección puede usarse, te llega un enlace" y no "listo,
 * te creamos la cuenta". Es a propósito y va en par con la ruta, que responde lo mismo
 * pase lo que pase: si acá dijéramos "ese correo ya está registrado", cualquiera podría
 * probar direcciones y averiguar quién tiene cuenta en un mapa de emergencia. Esa lista
 * no es inofensiva.
 */
export default function RegisterForm({ onSignIn }: { onSignIn?: () => void }) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const nameBad = displayName.length > 0 && displayNameInvalid(cleanDisplayName(displayName));
  const passBad = password.length > 0 && publicPasswordTooShort(password);
  const canSubmit =
    !busy &&
    !displayNameInvalid(cleanDisplayName(displayName)) &&
    !publicPasswordTooShort(password) &&
    email.includes("@");

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/account/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            displayName: cleanDisplayName(displayName),
            email: email.trim().toLowerCase(),
            password,
          }),
        });
        const data: { error?: string } = await res.json().catch(() => ({}));

        if (!res.ok) {
          // La contraseña filtrada y la corta son los dos únicos casos en los que decir la
          // verdad ayuda y no delata nada sobre otras cuentas.
          setError(
            data.error === "pwned_password"
              ? t("password.pwned")
              : data.error === "password_too_short"
                ? t("password.tooShort", { n: MIN_PASSWORD_PUBLIC })
                : data.error === "invalid_display_name"
                  ? t("register.errorName")
                  : data.error === "invalid_email"
                    ? t("register.errorEmail")
                    : t("admin.saveError"),
          );
          return;
        }
        setDone(true);
      } catch {
        setError(t("error.network"));
      } finally {
        setBusy(false);
      }
    },
    [canSubmit, displayName, email, password, t],
  );

  if (done) {
    return (
      <div className="form">
        <Notice tone="info">
          <strong>{t("register.doneTitle")}</strong>
          <br />
          {t("register.doneBody")}
        </Notice>
        <p className="small mut">{t("register.doneSpam")}</p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="small mut" style={{ margin: 0 }}>
        {t("register.subtitle")}
      </p>

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

      <Field label={t("register.email")} hint={t("register.emailHint")}>
        <Input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label={t("register.password")} hint={t("password.hint", { n: MIN_PASSWORD_PUBLIC })}>
        <Input
          required
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {passBad ? <p className="lerr">{t("password.tooShort", { n: MIN_PASSWORD_PUBLIC })}</p> : null}

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Button type="submit" loading={busy} disabled={!canSubmit} block>
        {busy ? t("register.submitting") : t("register.submit")}
      </Button>

      {onSignIn ? (
        <p className="small mut" style={{ margin: 0 }}>
          {t("register.haveAccount")}{" "}
          <button type="button" className="linkish" onClick={onSignIn}>
            {t("login.title")}
          </button>
        </p>
      ) : null}
    </form>
  );
}
