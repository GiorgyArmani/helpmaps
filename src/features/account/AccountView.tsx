"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Center } from "@/domain/types";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";
import { Icon } from "@/ui/icons";
import { Button, Input, Notice, Spinner } from "@/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";
import { cleanDisplayName, displayNameInvalid } from "@/domain/account";
import {
  fetchMySubmissions,
  fetchMyVolunteerRequest,
  updateMyProfile,
  type MySubmission,
  type MyVolunteerRequest,
} from "@/data/account";
import type { AccountState } from "@/features/account/useAccount";
import CenterCard from "@/features/centers/CenterCard";
import DigitalCard from "@/features/centers/DigitalCard";
import { isDigital } from "@/domain/center";
import LoginForm from "@/features/admin/LoginForm";
import { savedLabel, sentLabel } from "@/features/account/ledger";

/**
 * Mi cuenta, DENTRO de la aplicación.
 *
 * ── EL ORDEN ES EL ARGUMENTO ────────────────────────────────────────────────
 *
 * La página que esto reemplaza abría con el campo "nombre para mostrar". Nadie abre su
 * cuenta para cambiarse el nombre. Alguien que se hizo una cuenta en un mapa de
 * emergencia lo hizo para volver a encontrar los puntos que guardó, así que los guardados
 * van primero y todo lo demás va debajo:
 *
 *   1. quién eres, en una línea, con lo que llevas hecho contado en números
 *   2. TUS PUNTOS — y tocarlos abre el punto en el mapa, no una copia de la ficha
 *   3. lo que enviaste, y en qué quedó
 *   4. sumarme al equipo
 *
 * ── LOS GUARDADOS SALEN DEL MAPA QUE YA ESTÁ CARGADO ────────────────────────
 *
 * `favourites` guarda ids, y los puntos ya están en memoria: cruzarlos acá evita una
 * consulta entera y, sobre todo, devuelve `Center` completos. Por eso cada fila es un
 * `CenterCard` de verdad —la misma tarjeta de la lista, con su color de tipo y su estado—
 * y tocarla vuela el mapa hasta el punto. Una lista de nombres sueltos habría sido otra
 * pantalla que hay que aprender.
 *
 * Un id guardado que ya no está en el mapa se cuenta aparte y se dice, en vez de
 * desaparecer en silencio: que un refugio que guardaste ya no exista es información.
 */
export default function AccountView({
  account,
  centers,
  onOpenCenter,
  onVolunteer,
  justConfirmed,
}: {
  account: AccountState;
  centers: Center[];
  onOpenCenter: (id: string) => void;
  onVolunteer: () => void;
  justConfirmed?: boolean;
}) {
  const { t, lang } = useI18n();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subs, setSubs] = useState<MySubmission[] | null>(null);
  const [vol, setVol] = useState<MyVolunteerRequest | null>(null);

  const signedIn = Boolean(account.userId);

  // Lo enviado y la postulación se piden una vez, con la vista ya abierta. No entran en
  // `useAccount` porque el menú del avatar no los necesita, y ahí sí se pagarían en el
  // camino de alguien que sólo quería ver su nombre.
  useEffect(() => {
    if (!signedIn) return;
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    void (async () => {
      const [s, v] = await Promise.all([fetchMySubmissions(sb), fetchMyVolunteerRequest(sb)]);
      if (cancelled) return;
      setSubs(s);
      setVol(v);
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const savedCenters = useMemo(
    () => centers.filter((c) => account.favourites.has(c.id)),
    [centers, account.favourites],
  );
  // Guardados cuyo punto ya no está en el mapa: retirado, o de otra emergencia.
  const missing = account.favourites.size - savedCenters.length;

  const startEdit = useCallback(() => {
    setName(account.profile?.displayName ?? "");
    setSaved(false);
    setEditing(true);
  }, [account.profile]);

  const saveName = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const sb = getSupabase();
      const clean = cleanDisplayName(name);
      if (!sb || displayNameInvalid(clean) || busy) return;
      setBusy(true);
      try {
        await updateMyProfile(sb, { displayName: clean });
        setSaved(true);
        setEditing(false);
        account.refresh();
      } catch {
        /* un nombre inválido no llega acá: lo corta el guardia de arriba */
      } finally {
        setBusy(false);
      }
    },
    [account, busy, name],
  );

  if (!account.checked) {
    return (
      <div className="acc">
        <Spinner />
      </div>
    );
  }

  // Sin sesión: el formulario de acceso, y encima la única frase que explica para qué
  // sirve una cuenta EN ESTE mapa. "Inicia sesión para ver tu cuenta" no explica nada.
  if (!signedIn) {
    return (
      <div className="acc">
        <p className="acc-pitch">{t("account.whyAccount")}</p>
        <LoginForm onSignedIn={account.refresh} />
      </div>
    );
  }

  const displayName = account.profile?.displayName ?? null;
  const nameBad = name.length > 0 && displayNameInvalid(cleanDisplayName(name));
  const sent = subs?.length ?? 0;

  return (
    <div className="acc">
      {justConfirmed ? <Notice tone="info">{t("account.confirmed")}</Notice> : null}

      {/* ── Quién eres ──────────────────────────────────────────────────── */}
      <header className="acc-id">
        <span className="avatar avatar-xl avatar-signed" aria-hidden="true">
          {displayName ? [...displayName][0]!.toUpperCase() : <Icon.user />}
        </span>

        {editing ? (
          <form className="acc-rename" onSubmit={saveName}>
            <Input
              value={name}
              autoFocus
              aria-label={t("account.displayName")}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="acc-rename-row">
              <Button type="submit" loading={busy} disabled={nameBad || !name.trim()}>
                {busy ? t("common.saving") : t("common.save")}
              </Button>
              <button type="button" className="linkish" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </button>
            </div>
            {nameBad ? <p className="lerr">{t("register.errorName")}</p> : null}
          </form>
        ) : (
          <div className="acc-id-txt">
            <h2 className="acc-name">
              {displayName ?? t("account.noName")}
              <button
                type="button"
                className="acc-edit"
                aria-label={t("account.rename")}
                title={t("account.rename")}
                onClick={startEdit}
              >
                <Icon.pencil />
              </button>
            </h2>
            {/* Lo que esta cuenta ES en este mapa, en números que se pueden comprobar. */}
            <p className="acc-ledger">
              {savedLabel(t, account.favourites.size)}
              <span className="acc-sep" aria-hidden="true" />
              {sentLabel(t, sent)}
            </p>
            {saved ? <p className="acc-ok">{t("account.saved")}</p> : null}
          </div>
        )}
      </header>

      {/* ── Tus puntos ──────────────────────────────────────────────────── */}
      <section className="acc-sec">
        <h3 className="acc-h">{t("account.saved.title")}</h3>
        {savedCenters.length === 0 ? (
          <p className="acc-empty">{t("account.saved.none")}</p>
        ) : (
          <div className="acc-saved">
            {savedCenters.map((c) =>
              isDigital(c) ? (
                <DigitalCard key={c.id} center={c} onSelect={onOpenCenter} />
              ) : (
                <CenterCard key={c.id} center={c} onSelect={onOpenCenter} />
              ),
            )}
          </div>
        )}
        {missing > 0 ? <p className="acc-empty">{t("account.saved.gone", { n: missing })}</p> : null}
      </section>

      {/* ── Lo que enviaste ─────────────────────────────────────────────── */}
      <section className="acc-sec">
        <h3 className="acc-h">{t("account.mine")}</h3>
        {subs === null ? (
          <p className="acc-empty">{t("common.loading")}</p>
        ) : subs.length === 0 ? (
          <p className="acc-empty">{t("account.noSubmissions")}</p>
        ) : (
          <ul className="acc-subs">
            {subs.map((s) => (
              <li key={s.id} className="acc-sub">
                <p className="acc-sub-msg">{s.message}</p>
                <p className="acc-sub-meta">
                  <span className={`acc-dot acc-dot-${s.status}`} aria-hidden="true" />
                  {t(`account.status.${s.status}` as DictKey)}
                  {" · "}
                  {new Date(s.createdAt).toLocaleDateString(lang, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Sumarme al equipo ───────────────────────────────────────────── */}
      <section className="acc-sec">
        <h3 className="acc-h">{t("account.volunteer")}</h3>
        {vol === null ? (
          <>
            <p className="acc-empty">{t("account.volNone")}</p>
            <button type="button" className="acc-cta" onClick={onVolunteer}>
              {t("account.volApply")}
              <Icon.chevron />
            </button>
          </>
        ) : vol.status === "pending" ? (
          <Notice tone="info">{t("account.volPending")}</Notice>
        ) : vol.status === "approved" ? (
          <Notice tone="info">{t("account.volApproved")}</Notice>
        ) : (
          <Notice tone="info">{t("account.volRejected")}</Notice>
        )}
      </section>

      <p className="acc-fine">{t("account.privacy")}</p>
    </div>
  );
}
