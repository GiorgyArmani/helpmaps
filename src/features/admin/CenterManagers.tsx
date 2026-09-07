"use client";

import { useState } from "react";
import { Button, Field, Input, Notice } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";

/**
 * «Quién gestiona este punto» — el bloque que reparte las llaves.
 *
 * Vive DENTRO de la ficha del punto en el panel del equipo, y no en una pantalla de
 * administración aparte, porque la pregunta sólo tiene sentido mirando un punto concreto:
 * invitar a alguien «a gestionar algo» sin ver qué es no se puede contestar bien.
 *
 * ── EL ENLACE SE DEVUELVE SIEMPRE, HAYA CORREO O NO ─────────────────────────
 *
 * El correo es opcional a propósito. Aquí buena parte de la coordinación va por WhatsApp,
 * y exigir una dirección para poder invitar deja fuera a mucha gente que sí dirige un
 * comedor. Sin correo se genera el enlace y lo manda quien invita, por donde ya hable con
 * esa persona.
 *
 * Con correo, además, la invitación queda atada a él: `accept_center_invite` lo comprueba,
 * así que un enlace reenviado no convierte en gestor a quien lo reciba de rebote. Sin
 * correo, vale quien tenga el enlace — y por eso el texto avisa de lo que es.
 */
export default function CenterManagers({ locationId }: { locationId: string | null }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Un punto que todavía no existe no tiene a quién invitar: la invitación cuelga de su
  // `location_id`, y el de un formulario sin guardar es `null`.
  if (!locationId) {
    return (
      <fieldset className="fset">
        <legend className="fld-sec">{t("admin.managers")}</legend>
        <p className="fhint">{t("admin.inviteSaveFirst")}</p>
      </fieldset>
    );
  }

  async function invite() {
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/staff/center-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId, email: email.trim() || undefined }),
      });
      const data: { url?: string; emailed?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error === "invalid_email" ? t("register.errorEmail") : t("admin.saveError"));
        return;
      }
      setLink(data.url);
      setSent(Boolean(data.emailed));
    } catch {
      setError(t("error.network"));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles el enlace sigue a la vista y se selecciona a mano.
    }
  }

  return (
    <fieldset className="fset">
      <legend className="fld-sec">{t("admin.managers")}</legend>
      <p className="fhint">{t("admin.managersHint")}</p>

      <Field label={t("admin.inviteEmail")} hint={t("admin.inviteEmailHint")}>
        <Input
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {sent ? <Notice tone="info">{t("admin.inviteSent")}</Notice> : null}

      {link ? (
        <Field label={t("admin.inviteLink")} hint={t("admin.inviteLinkHint")}>
          {/* De sólo lectura y seleccionable: es para copiar, no para editar. */}
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </Field>
      ) : null}

      <div className="wrapline">
        <Button type="button" variant="ghost" onClick={() => void invite()} loading={busy}>
          {busy ? t("common.saving") : t("admin.invite")}
        </Button>
        {link ? (
          <Button type="button" variant="ghost" onClick={() => void copy()}>
            {copied ? t("common.copied") : t("common.copy")}
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
}
