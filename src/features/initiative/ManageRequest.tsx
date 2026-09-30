"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/context";
import { Icon } from "@/ui/icons";
import { Button, Field, Input, Notice, TextArea } from "@/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";
import { useAccount } from "@/features/account/useAccount";
import {
  fetchManagedLocations,
  fetchMyManageRequest,
  type ManageRequestStatus,
} from "@/data/initiatives";

/**
 * «¿Es tu organización?» — la puerta para que una ONG que ya está en el mapa tome el
 * control de su perfil sin esperar a que el equipo la invite.
 *
 * ── DISCRETO, Y AL FINAL ────────────────────────────────────────────────────
 *
 * Quien abre una ficha casi siempre viene a buscar ayuda, no a administrarla. Por eso va
 * al final de «Información» y como bloque apagado, nunca como botón principal: el único
 * primario de la ficha sigue siendo llegar al sitio.
 *
 * ── `?gestionar=1` ──────────────────────────────────────────────────────────
 *
 * Abre el formulario directamente. Es el enlace que lleva la campaña de captación
 * («tu organización ya está en HelpMaps») y es también a donde vuelve quien tuvo que
 * crear la cuenta primero: sin él, después de registrarse aterrizaría en la ficha sin
 * recordar qué iba a hacer.
 *
 * ── NO CONCEDE NADA ─────────────────────────────────────────────────────────
 *
 * Deja una solicitud que el equipo comprueba (ver `db/15_gestion.sql`). El texto lo dice,
 * porque gestionar un punto incluye sus datos para donar, y prometer acceso inmediato
 * sería prometer que cualquiera puede quedarse con la ficha de un comedor.
 */
export default function ManageRequest({ locationId }: { locationId: string }) {
  const { t } = useI18n();
  const account = useAccount(true);
  const titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  // null = todavía no se sabe. Se resuelve una vez con la sesión.
  const [manages, setManages] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ManageRequestStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El enlace de la campaña abre el formulario solo. Se lee de `location` y no con
  // `useSearchParams`, que obligaría a la página pública entera a renderizarse en cliente.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("gestionar") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de la URL al montar
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!account.checked || !account.userId) return;
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void Promise.all([
      fetchManagedLocations(sb, account.userId),
      fetchMyManageRequest(sb, account.userId, locationId),
    ]).then(([ids, req]) => {
      if (!vivo) return;
      setManages(ids.includes(locationId));
      setStatus(req?.status ?? null);
    });
    return () => {
      vivo = false;
    };
  }, [account.checked, account.userId, locationId]);

  // Al abrirse, el primer campo recibe el foco: quien pulsó ya decidió. `manages` va en
  // las dependencias porque el formulario no existe hasta que se sabe que no gestiona ya
  // el punto; con `?gestionar=1` eso llega después de abrir. El foco además lo trae a la
  // vista, que es lo que busca quien llegó por el enlace de la campaña.
  useEffect(() => {
    if (open && account.userId && manages === false) {
      formRef.current?.querySelector("input")?.focus();
    }
  }, [open, account.userId, manages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (role.trim().length < 2) {
      setError(t("manage.errorRole"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/centers/manage-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId, role, phone, proof }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (res.ok || data.error === "already_pending") {
        setStatus("pending");
        setOpen(false);
      } else if (data.error === "already_manager") {
        setManages(true);
      } else {
        setError(t("manage.errorSend"));
      }
    } catch {
      setError(t("error.network"));
    } finally {
      setBusy(false);
    }
  }

  // Sin sesión resuelta no se dibuja nada: es lo último de la ficha, así que no empuja
  // nada que alguien estuviera leyendo.
  if (!account.checked) return null;
  if (account.userId && manages === null) return null;

  if (manages) {
    return (
      <section className="mreq mreq-done" aria-labelledby={titleId}>
        <span className="mreq-ic" aria-hidden="true">
          <Icon.check />
        </span>
        <div className="mreq-txt">
          <h3 id={titleId} className="mreq-t">
            {t("manage.youManage")}
          </h3>
        </div>
        <Link className="btng btnblock" href="/?mine=1">
          <Icon.pencil />
          {t("manage.edit")}
        </Link>
      </section>
    );
  }

  if (status === "pending") {
    return (
      <section className="mreq" aria-labelledby={titleId} aria-live="polite">
        <span className="mreq-ic" aria-hidden="true">
          <Icon.clock />
        </span>
        <div className="mreq-txt">
          <h3 id={titleId} className="mreq-t">
            {t("manage.pendingTitle")}
          </h3>
          <p className="mreq-d">{t("manage.pendingBody")}</p>
        </div>
      </section>
    );
  }

  const volver = `/c/${encodeURIComponent(locationId)}?gestionar=1`;

  return (
    <section className="mreq" aria-labelledby={titleId}>
      <span className="mreq-ic" aria-hidden="true">
        <Icon.shield />
      </span>
      <div className="mreq-txt">
        <h3 id={titleId} className="mreq-t">
          {t("manage.title")}
        </h3>
        <p className="mreq-d">
          {status === "rejected" ? t("manage.again") : t("manage.body")}
        </p>
      </div>

      {!account.userId ? (
        // Sin cuenta: se explica y se lleva a crearla, con la vuelta puesta.
        <div className="mreq-acts">
          <Link className="btnp btnblock" href={`/registro?next=${encodeURIComponent(volver)}`}>
            {t("manage.cta")}
          </Link>
          <p className="mreq-d">
            {t("manage.haveAccount")}{" "}
            <Link className="linkish" href={`/login?next=${encodeURIComponent(volver)}`}>
              {t("manage.login")}
            </Link>
          </p>
        </div>
      ) : !open ? (
        <div className="mreq-acts">
          <Button variant="ghost" block onClick={() => setOpen(true)} aria-expanded={false}>
            {t("manage.cta")}
          </Button>
        </div>
      ) : (
        <form ref={formRef} className="mreq-form" onSubmit={(e) => void send(e)} noValidate>
          <Field label={t("manage.role")} hint={t("manage.roleHint")}>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              autoComplete="organization-title"
              maxLength={120}
              required
              aria-invalid={error === t("manage.errorRole") || undefined}
            />
          </Field>
          <Field label={t("manage.phone")} hint={t("manage.phoneHint")} optional optionalLabel={t("common.optional")}>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
            />
          </Field>
          <Field label={t("manage.proof")} hint={t("manage.proofHint")} optional optionalLabel={t("common.optional")}>
            <TextArea
              rows={3}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              maxLength={600}
            />
          </Field>

          <p className="mreq-d">{t("manage.review")}</p>

          {error ? <Notice tone="danger">{error}</Notice> : null}

          <div className="mreq-row">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? t("common.saving") : t("manage.send")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
