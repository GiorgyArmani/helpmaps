"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Center } from "@/domain/types";
import { useI18n } from "@/i18n/context";
import {
  AchievementsSection,
  BADGE_TOTAL,
  levelOf,
  useRecognition,
} from "@/features/account/Recognition";
import MyEvents from "@/features/account/MyEvents";
import VolunteerProfile from "@/features/account/VolunteerProfile";
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
import { useSite } from "@/features/app/SiteProvider";
import { useSessionPeek } from "@/features/account/useSessionPeek";
import { faunaOf } from "@/domain/avatar";
import { myAvatar } from "@/features/avatar/mine";
import { AvatarCard } from "@/features/avatar/AvatarArt";

/** Las secciones de la cuenta. Cada una abre su propia pantalla desde el menú. */
export type AccountSection =
  "saved" | "achievements" | "events" | "help" | "sent";
type Section = AccountSection;

/** El título de cada sección: lo pinta la cabecera del panel mientras está abierta. */
export const ACCOUNT_SECTION_TITLE: Record<AccountSection, DictKey> = {
  saved: "account.saved.title",
  achievements: "account.menu.achievements",
  events: "myEvents.title",
  help: "vol.title",
  sent: "account.mine",
};

/**
 * Mi cuenta, DENTRO de la aplicación, armada como el perfil de una app del teléfono.
 *
 * ── UN MENÚ, NO UN ROLLO ────────────────────────────────────────────────────
 *
 * Antes era una sola columna con todo —nivel, medallas, eventos, oficios, guardados, lo
 * enviado, el equipo, la contraseña— y llegar a lo que se buscaba era bajar varias
 * pantallas con el pulgar. Ahora la portada de la cuenta es corta y siempre igual:
 *
 *   1. TU TARJETA: tu avatar con su nivel, tu nombre y cuánto falta para el siguiente.
 *   2. UN MENÚ de botones grandes, uno por sección, con su recuento al lado.
 *
 * Tocar un botón abre ESA sección en su propia pantalla: la cabecera del panel dice cuál y
 * su flecha vuelve al menú de la cuenta (la sección vive en `AppShell` por eso). Lo
 * que se edita (el avatar, la contraseña) vive aparte, en Configuración: esta pantalla es
 * para ver lo tuyo de un vistazo.
 *
 * ── LOS GUARDADOS SALEN DEL MAPA QUE YA ESTÁ CARGADO ────────────────────────
 *
 * `favourites` guarda ids, y los puntos ya están en memoria: cruzarlos acá evita una
 * consulta entera y devuelve `Center` completos, así que cada fila es la misma tarjeta de
 * la lista y tocarla vuela el mapa hasta el punto. Un id guardado que ya no está en el mapa
 * se cuenta aparte: que un refugio que guardaste ya no exista es información.
 */
export default function AccountView({
  account,
  centers,
  onOpenCenter,
  onVolunteer,
  isStaff,
  onOpenPanel,
  onOpenSettings,
  section,
  onSection,
  justConfirmed,
}: {
  account: AccountState;
  centers: Center[];
  onOpenCenter: (id: string) => void;
  onVolunteer: () => void;
  /** Del equipo, sí o no; `null` mientras el rol no ha llegado. */
  isStaff: boolean | null;
  onOpenPanel: () => void;
  /** Configuración: cambiar el avatar y la contraseña. */
  onOpenSettings: () => void;
  /** La sección abierta, o `null` en el menú. La controla `AppShell`. */
  section: AccountSection | null;
  onSection: (s: AccountSection | null) => void;
  justConfirmed?: boolean;
}) {
  const { t, lang } = useI18n();
  const site = useSite();
  const peek = useSessionPeek();
  const fauna = useMemo(() => faunaOf(site.country), [site.country]);
  const mine = useMemo(
    () => myAvatar(fauna, account.profile?.avatar, peek.avatar),
    [fauna, account.profile?.avatar, peek.avatar],
  );

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [subs, setSubs] = useState<MySubmission[] | null>(null);
  const [vol, setVol] = useState<MyVolunteerRequest | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const signedIn = Boolean(account.userId);
  const rec = useRecognition(account.userId);
  const nivel = levelOf(rec);

  // Lo enviado y la postulación se piden una vez, con la vista ya abierta. No entran en
  // `useAccount` porque el menú del avatar no los necesita.
  useEffect(() => {
    if (!signedIn) return;
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    void (async () => {
      const [s, v] = await Promise.all([
        fetchMySubmissions(sb),
        fetchMyVolunteerRequest(sb),
      ]);
      if (cancelled) return;
      setSubs(s);
      setVol(v);
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  // Al entrar o salir de una sección, arriba del todo y el foco en su título.
  useEffect(() => {
    root.current?.closest(".ovbody")?.scrollTo({ top: 0 });
    if (section) heading.current?.focus();
  }, [section]);

  const savedCenters = useMemo(
    () => centers.filter((c) => account.favourites.has(c.id)),
    [centers, account.favourites],
  );
  const missing = account.favourites.size - savedCenters.length;

  const startEdit = useCallback(() => {
    setName(account.profile?.displayName ?? "");
    setSaved(false);
    setSaveFailed(false);
    setEditing(true);
  }, [account.profile]);

  const saveName = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const sb = getSupabase();
      const clean = cleanDisplayName(name);
      if (!sb || displayNameInvalid(clean) || busy) return;
      setBusy(true);
      setSaveFailed(false);
      try {
        await updateMyProfile(sb, { displayName: clean });
        setSaved(true);
        setEditing(false);
        account.refresh();
      } catch {
        // Lo que llega acá es la red o la base, y eso se dice: callarlo deja a la persona
        // creyendo que se guardó.
        setSaveFailed(true);
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
  // sirve una cuenta EN ESTE mapa.
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

  // ── Una sección, en su propia pantalla ──────────────────────────────────
  if (section) {
    return (
      <div className="acc acc-pane" ref={root}>
        {/* El título va en la cabecera del panel; aquí, sólo para el lector de pantalla y
            para llevarle el foco al entrar. */}
        <h2 ref={heading} tabIndex={-1} className="acc-pane-h">
          {t(ACCOUNT_SECTION_TITLE[section])}
        </h2>

        {section === "saved" ? (
          <>
            {savedCenters.length === 0 ? (
              <p className="acc-empty">{t("account.saved.none")}</p>
            ) : (
              <div className="acc-saved">
                {savedCenters.map((c) =>
                  isDigital(c) ? (
                    <DigitalCard
                      key={c.id}
                      center={c}
                      onSelect={onOpenCenter}
                    />
                  ) : (
                    <CenterCard key={c.id} center={c} onSelect={onOpenCenter} />
                  ),
                )}
              </div>
            )}
            {missing > 0 ? (
              <p className="acc-empty">
                {t("account.saved.gone", { n: missing })}
              </p>
            ) : null}
          </>
        ) : null}

        {section === "achievements" ? <AchievementsSection rec={rec} /> : null}

        {section === "events" && account.userId ? (
          <MyEvents userId={account.userId} onOpenCenter={onOpenCenter} />
        ) : null}

        {section === "help" ? (
          <>
            <VolunteerProfile
              profile={account.profile}
              onSaved={account.refresh}
            />
            {/* Quien ya es del equipo no se postula: le sale la puerta a su panel. Lo
                decide `staff_users` y no la postulación. Mientras el rol no llega, el hueco
                del botón y no un «Postularme» que cambia. */}
            <section className="acc-sec">
              <h3 className="acc-h">
                {isStaff ? t("admin.title") : t("account.volunteer")}
              </h3>
              {isStaff === null ? (
                <span className="skel acc-skel" aria-hidden="true" />
              ) : isStaff ? (
                <>
                  <p className="acc-empty">{t("account.teamNote")}</p>
                  <button
                    type="button"
                    className="acc-cta"
                    onClick={onOpenPanel}
                  >
                    {t("account.openPanel")}
                    <Icon.chevron />
                  </button>
                </>
              ) : vol === null ? (
                <>
                  <p className="acc-empty">{t("account.volNone")}</p>
                  <button
                    type="button"
                    className="acc-cta"
                    onClick={onVolunteer}
                  >
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
          </>
        ) : null}

        {section === "sent" ? (
          subs === null ? (
            <span className="skel acc-skel" aria-hidden="true" />
          ) : subs.length === 0 ? (
            <p className="acc-empty">{t("account.noSubmissions")}</p>
          ) : (
            <ul className="acc-subs">
              {subs.map((s) => (
                <li key={s.id} className="acc-sub">
                  <p className="acc-sub-msg">{s.message}</p>
                  <p className="acc-sub-meta">
                    <span
                      className={`acc-dot acc-dot-${s.status}`}
                      aria-hidden="true"
                    />
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
          )
        ) : null}
      </div>
    );
  }

  // ── La portada: tu tarjeta y el menú ────────────────────────────────────
  const hasAvatar = fauna.length > 0;
  const menu: {
    id: Section;
    icon: keyof typeof Icon;
    label: string;
    sub: string | null;
  }[] = [
    {
      id: "saved",
      icon: "heart",
      label: t("account.saved.title"),
      sub: savedLabel(t, account.favourites.size),
    },
    {
      id: "achievements",
      icon: "spark",
      label: t("account.menu.achievements"),
      sub: rec.counts
        ? t("account.menu.badges", { n: rec.earned.size, total: BADGE_TOTAL })
        : null,
    },
    {
      id: "events",
      icon: "clock",
      label: t("myEvents.title"),
      sub: t("account.menu.eventsSub"),
    },
    {
      id: "help",
      icon: "volunteer",
      label: t("vol.title"),
      sub: t("account.menu.helpSub"),
    },
    {
      id: "sent",
      icon: "mail",
      label: t("account.mine"),
      sub: subs === null ? null : sentLabel(t, sent),
    },
  ];

  return (
    <div className="acc acc-home" ref={root}>
      {justConfirmed ? (
        <Notice tone="info">{t("account.confirmed")}</Notice>
      ) : null}

      {/* ── Tu tarjeta ──────────────────────────────────────────────────── */}
      <header className="acc-hero">
        {hasAvatar ? (
          // Tocar el avatar lleva a cambiarlo: es lo primero que se quiere tocar.
          <button
            type="button"
            className="acc-hero-ave"
            aria-label={mine ? t("avatar.edit") : t("avatar.create")}
            onClick={onOpenSettings}
          >
            {mine ? (
              <AvatarCard avatar={mine} />
            ) : (
              <span className="ave-card acc-hero-none" aria-hidden="true" />
            )}
            {nivel ? (
              <span className="acc-hero-lvl" aria-hidden="true">
                {nivel.level}
              </span>
            ) : null}
            <span className="acc-hero-pen" aria-hidden="true">
              <Icon.pencil width={13} height={13} />
            </span>
          </button>
        ) : (
          <span className="avatar avatar-xl avatar-signed" aria-hidden="true">
            {displayName ? [...displayName][0]!.toUpperCase() : <Icon.user />}
          </span>
        )}

        <div className="acc-hero-txt">
          {editing ? (
            <form className="acc-rename" onSubmit={saveName}>
              <Input
                value={name}
                autoFocus
                aria-label={t("account.displayName")}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="acc-rename-row">
                <Button
                  type="submit"
                  loading={busy}
                  disabled={nameBad || !name.trim()}
                >
                  {busy ? t("common.saving") : t("common.save")}
                </Button>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => setEditing(false)}
                >
                  {t("common.cancel")}
                </button>
              </div>
              {nameBad ? (
                <p className="lerr">{t("register.errorName")}</p>
              ) : null}
              {saveFailed ? (
                <p className="lerr">{t("admin.saveError")}</p>
              ) : null}
            </form>
          ) : (
            <h2 className="acc-name">
              <span className="acc-name-t">
                {displayName ?? t("account.noName")}
              </span>
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
          )}
          {saved && !editing ? (
            <p className="acc-ok">{t("account.saved")}</p>
          ) : null}

          {nivel && rec.counts ? (
            <>
              <p className="acc-hero-lv">
                <b>
                  {t("account.levelN", {
                    n: nivel.level,
                    label: t(nivel.label),
                  })}
                </b>
                <span>
                  {rec.counts.xp === 1
                    ? t("rec.xpOne")
                    : t("rec.xp", { n: rec.counts.xp })}
                </span>
              </p>
              {/* La barra dice lo que el número solo no puede: si estás cerca. */}
              <div
                className="rec-bar"
                role="progressbar"
                aria-valuenow={Math.round(nivel.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t(nivel.label)}
              >
                <span
                  className="rec-bar-fill"
                  style={{ width: `${Math.round(nivel.progress * 100)}%` }}
                />
              </div>
              <span className="rec-next">
                {nivel.next && nivel.toNext !== null
                  ? t("rec.toNext", {
                      n: nivel.toNext,
                      level: t(nivel.next.label),
                    })
                  : t("rec.maxLevel")}
              </span>
            </>
          ) : (
            // El hueco del nivel mientras llega: la tarjeta no cambia de alto.
            <span className="skel acc-hero-skel" aria-hidden="true" />
          )}
        </div>
      </header>

      {/* ── El menú: una fila por sección, y Configuración aparte ───────────── */}
      <nav className="acc-menu" aria-label={t("account.title")}>
        {menu.map((m) => {
          const Ic = Icon[m.icon];
          return (
            <button
              key={m.id}
              type="button"
              className="acc-mi"
              onClick={() => onSection(m.id)}
            >
              <span className="acc-mi-ic" aria-hidden="true">
                <Ic width={20} height={20} />
              </span>
              <span className="acc-mi-txt">
                <b>{m.label}</b>
                {m.sub === null ? (
                  <span className="skel acc-mi-skel" aria-hidden="true" />
                ) : (
                  <span>{m.sub}</span>
                )}
              </span>
              <Icon.chevron className="acc-mi-go" width={18} height={18} />
            </button>
          );
        })}
      </nav>

      <nav className="acc-menu" aria-label={t("settings.title")}>
        <button type="button" className="acc-mi" onClick={onOpenSettings}>
          <span className="acc-mi-ic" aria-hidden="true">
            <Icon.gear width={20} height={20} />
          </span>
          <span className="acc-mi-txt">
            <b>{t("settings.title")}</b>
            <span>
              {hasAvatar
                ? t("account.menu.settingsSub")
                : t("account.security")}
            </span>
          </span>
          <Icon.chevron className="acc-mi-go" width={18} height={18} />
        </button>
      </nav>

      <p className="acc-fine">{t("account.privacy")}</p>
    </div>
  );
}
