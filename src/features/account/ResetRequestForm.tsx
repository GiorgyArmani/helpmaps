"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/i18n/context";
import { Button, Field, Input, Notice } from "@/ui/primitives";

/**
 * Pedir el enlace para elegir una contraseña nueva.
 *
 * ── EL ÉXITO NO DICE SI LA CUENTA EXISTE ────────────────────────────────────
 *
 * Igual que el registro, y por lo mismo: el mensaje final dice «si esa dirección tiene
 * cuenta, te llega un enlace» y nunca «no encontramos esa cuenta». Si aquí se distinguiera
 * un caso del otro, cualquiera podría probar direcciones y averiguar quién tiene cuenta
 * en un mapa de emergencia venezolano. Esa lista no es inofensiva, y la ruta responde lo
 * mismo pase lo que pase para que esta pantalla no pueda delatarlo ni por accidente.
 *
 * El único error que sí se muestra es el correo mal escrito, que no delata nada: habla
 * de lo que se acaba de teclear, no de lo que hay en la base.
 */
export default function ResetRequestForm({ onBack }: { onBack?: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = !busy && email.includes("@");

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/account/reset", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        const data: { error?: string } = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            data.error === "invalid_email" ? t("register.errorEmail") : t("error.generic"),
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
    [canSubmit, email, t],
  );

  if (done) {
    return (
      <div className="form">
        <Notice tone="info">
          <strong>{t("forgot.doneTitle")}</strong>
          <br />
          {t("forgot.doneBody")}
        </Notice>
        <p className="small mut">{t("register.doneSpam")}</p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field label={t("register.email")} hint={t("forgot.emailHint")}>
        <Input
          required
          autoFocus
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Button type="submit" loading={busy} disabled={!canSubmit} block>
        {busy ? t("forgot.submitting") : t("forgot.submit")}
      </Button>

      {onBack ? (
        <p className="small mut" style={{ margin: 0 }}>
          <button type="button" className="linkish" onClick={onBack}>
            {t("forgot.remembered")}
          </button>
        </p>
      ) : null}
    </form>
  );
}
