"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Field, Input, Notice } from "@/ui/primitives";
import { useI18n, useTimeAgo } from "@/i18n/context";
import { Icon } from "@/ui/icons";
import { getSupabase } from "@/lib/supabase/client";
import {
  cancelInvite,
  fetchCenterManagers,
  fetchPendingInvites,
  revokeCenterManager,
  type CenterManager,
  type PendingInvite,
} from "@/data/initiatives";

/**
 * «Quién gestiona este punto» — el bloque que reparte las llaves, y que las retira.
 *
 * Vive DENTRO de la ficha del punto en el panel del equipo, y no en una pantalla de
 * administración aparte, porque la pregunta sólo tiene sentido mirando un punto concreto:
 * invitar a alguien «a gestionar algo» sin ver qué es no se puede contestar bien.
 *
 * ── LO QUE HAY QUE PODER HACER, Y NO SÓLO INVITAR ───────────────────────────
 *
 * La primera versión sólo invitaba. Eso dejaba dos agujeros: no se podía retirarle el
 * acceso a nadie, ni cancelar una invitación mandada por error — las dos cosas exigían
 * entrar a Supabase a mano.
 *
 * Importa porque el modelo de confianza de este proyecto no dice «revisamos antes de dar
 * acceso», dice «el acceso es REVOCABLE AL INSTANTE». Con un permiso que se reparte con
 * un botón y se retira con una consulta SQL, esa frase deja de ser verdad.
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
  const ago = useTimeAgo();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [managers, setManagers] = useState<CenterManager[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  // Se pide otra vuelta subiendo el contador, en vez de tener una función async que
  // escriba estado desde dos sitios distintos. Misma forma que en `InitiativePanel`.
  const [vuelta, setVuelta] = useState(0);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);

  useEffect(() => {
    if (!locationId) return;
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void Promise.all([
      fetchCenterManagers(sb, locationId),
      fetchPendingInvites(sb, locationId),
    ]).then(([m, i]) => {
      if (!vivo) return;
      setManagers(m);
      setInvites(i);
    });
    return () => {
      vivo = false;
    };
  }, [locationId, vuelta]);

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
      setEmail("");
      recargar();
    } catch {
      setError(t("error.network"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    const sb = getSupabase();
    if (!sb || !locationId) return;
    setError(null);
    try {
      await revokeCenterManager(sb, locationId, userId);
      recargar();
    } catch {
      setError(t("admin.saveError"));
    }
  }

  async function drop(id: string) {
    const sb = getSupabase();
    if (!sb) return;
    setError(null);
    try {
      await cancelInvite(sb, id);
      recargar();
    } catch {
      setError(t("admin.saveError"));
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

      {/* Quién tiene acceso HOY. Va primero: antes de repartir otra llave conviene ver
          cuántas hay dadas. */}
      {managers.length > 0 ? (
        <ul className="mgr-list">
          {managers.map((m) => (
            <li key={m.user_id} className="mgr-row">
              <span className="mgr-who">
                <b>{m.display_name ?? t("account.noName")}</b>
                <span className="mgr-since">{t("admin.managerSince", { ago: ago(m.created_at) })}</span>
              </span>
              <button
                type="button"
                className="mgr-x"
                onClick={() => void revoke(m.user_id)}
                title={t("admin.revoke")}
                aria-label={t("admin.revoke")}
              >
                <Icon.close />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {invites.length > 0 ? (
        <ul className="mgr-list">
          {invites.map((i) => (
            <li key={i.id} className="mgr-row mgr-row-pending">
              <span className="mgr-who">
                <b>{i.email ?? t("admin.inviteAnyone")}</b>
                <span className="mgr-since">{t("admin.invitePending")}</span>
              </span>
              <button
                type="button"
                className="mgr-x"
                onClick={() => void drop(i.id)}
                title={t("admin.inviteCancel")}
                aria-label={t("admin.inviteCancel")}
              >
                <Icon.close />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

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
