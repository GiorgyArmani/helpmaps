"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LocationType } from "@/domain/types";
import { AVAILABILITY, SKILLS, type Availability, type Skill } from "@/domain/volunteer";
import type { DictKey } from "@/i18n";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import { regionLabel } from "@/config";
import { Button, Field, Input, Notice, Select } from "@/ui/primitives";
import { Icon } from "@/ui/icons";
import { MIN_PASSWORD_PUBLIC, publicPasswordTooShort } from "@/lib/password";
import { cleanDisplayName, displayNameInvalid } from "@/domain/account";
import ToggleChips from "@/features/volunteer/ToggleChips";
import { skillLabel } from "@/features/volunteer/EventNeeds";
import { searchDirectory } from "../../../app/organizaciones/search";
import { SPECIES, faunaOf, starterAvatar, type Avatar } from "@/domain/avatar";
import AvatarEditor from "@/features/avatar/AvatarEditor";
import { AvatarCard, AvatarDisc, AvatarScene } from "@/features/avatar/AvatarArt";

/** Para qué viene la persona: decide el recorrido entero. */
export type Purpose = "help" | "give" | "org";

export type StepId = "avatar" | "name" | "choose" | "skills" | "org" | "account";

/** Las cuatro etapas que se ven arriba. Perfil agrupa la pregunta del camino y lo que pide. */
type Phase = "avatar" | "name" | "profile" | "account";
const PHASE_OF: Record<StepId, Phase> = {
  avatar: "avatar",
  name: "name",
  choose: "profile",
  skills: "profile",
  org: "profile",
  account: "account",
};

/**
 * Cada camino pide lo suyo y nada más:
 * - quien busca ayuda sólo necesita su usuario;
 * - quien quiere ayudar dice qué sabe hacer y cuándo puede (su perfil de voluntario);
 * - quien representa una organización la busca, para pedir acceso a ESA.
 */
const PATHS: Record<Purpose, StepId[]> = {
  help: ["choose", "account"],
  give: ["choose", "skills", "account"],
  org: ["choose", "org", "account"],
};

const PURPOSES: { k: Purpose; icon: "shelter" | "heart" | "users" }[] = [
  { k: "help", icon: "shelter" },
  { k: "give", icon: "heart" },
  { k: "org", icon: "users" },
];

interface OrgRow {
  id: string;
  name: string;
  type: LocationType;
  municipality: string | null;
  region: string | null;
}

/**
 * La bienvenida a la plataforma, en pasos (`/registro`).
 *
 * ── UN RECORRIDO POR PERSONA ────────────────────────────────────────────────
 *
 * La primera pregunta —«¿cómo quieres usar HelpMaps?»— no es un formulario más: decide qué
 * viene después. Quien busca ayuda crea su usuario y entra al mapa; pedirle algo más sería
 * ponerle trámites en medio de una emergencia. Quien quiere ayudar cuenta qué sabe hacer,
 * que es lo que una organización necesita saber de un voluntario. Quien representa una
 * organización la busca aquí mismo, y el enlace de confirmación lo deja en su ficha para
 * pedir acceso (o, si no está, en el alta de `/organizaciones`).
 *
 * La página cambia su titular con la elección (`onPurpose`): la pantalla entera pasa a
 * hablarle a esa persona.
 *
 * ── LO QUE SE GUARDA ────────────────────────────────────────────────────────
 *
 * El usuario (nombre para mostrar, correo, contraseña) y, sólo si la persona lo marca, sus
 * oficios y su disponibilidad: lo mismo que guardaría en «Cómo puedes ayudar», y que sólo
 * ve la organización de un evento al que se anote. La elección del camino NO se guarda:
 * sólo decide los pasos y a dónde lleva el enlace del correo (`next`).
 *
 * Quien llega con un `next` (una invitación) ya sabe a dónde va: sólo crea su usuario.
 *
 * ── PRIMERO SE CREA UN PERSONAJE ────────────────────────────────────────────
 *
 * El registro empieza como un videojuego: la persona elige su avatar —un animal de la
 * fauna del país, vestido a su gusto (`AvatarEditor`)— y después le pone nombre, con el
 * personaje saludando y diciéndolo mientras se escribe. Sólo entonces vienen las preguntas
 * y, al final, el correo y la contraseña. Es lo primero que se lleva de la plataforma y lo
 * que la hace suya; viaja con la cuenta y la barra lo dibuja en cuanto entra. Se puede
 * seguir con el que viene puesto: nadie se queda atascado eligiendo. Un país sin fauna en
 * su preset salta el avatar y empieza por el nombre.
 *
 * Arriba siempre se ven las etapas —Avatar, Nombre, Perfil, Cuenta— y, desde que tiene
 * nombre, la ficha del personaje: quién se está creando, y la puerta para volver a vestirlo.
 *
 * ── POR QUÉ EL «ÉXITO» NO DICE SI LA CUENTA SE CREÓ ─────────────────────────
 *
 * El final dice «si esa dirección puede usarse, te llega un enlace», no «te creamos la
 * cuenta». Va en par con la ruta, que responde lo mismo pase lo que pase: decir «ese
 * correo ya está registrado» dejaría averiguar quién tiene cuenta en un mapa de
 * emergencia, y esa lista no es inofensiva.
 */
export default function RegisterStepper({
  next,
  onSignIn,
  onPurpose,
  onStep,
}: {
  next?: string | null;
  onSignIn?: () => void;
  /** La elección, para que la página cambie su titular. */
  onPurpose?: (p: Purpose | null) => void;
  /** El paso visible: la página esconde su titular mientras se crea el personaje. */
  onStep?: (s: StepId | "done") => void;
}) {
  const { t } = useI18n();
  const site = useSite();
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [at, setAt] = useState(0);
  // Su compañero. Arranca con el primer animal del país para que «Continuar» ya sirva.
  const fauna = useMemo(() => faunaOf(site.country), [site.country]);
  const hasAvatar = fauna.length > 0;
  const [avatar, setAvatar] = useState<Avatar>(() => starterAvatar(fauna[0] ?? SPECIES[0]));
  // La cuenta.
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState({ name: false, email: false });
  // Quien quiere ayudar.
  const [skills, setSkills] = useState<Skill[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [region, setRegion] = useState("");
  // Quien representa una organización.
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null);
  const [orgsFailed, setOrgsFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [org, setOrg] = useState<OrgRow | "none" | null>(null);
  // El envío.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const first: StepId[] = hasAvatar ? ["avatar", "name"] : ["name"];
  const steps: StepId[] = next
    ? [...first, "account"]
    : purpose
      ? [...first, ...PATHS[purpose]]
      : [...first, "choose"];
  const step = steps[at] ?? "choose";
  // Dónde está la pregunta del camino: después del avatar y del nombre.
  const chooseAt = first.length;

  // Al cambiar de paso, el foco va a su pregunta (el lector la anuncia). No al abrir.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [at, purpose, done]);

  useEffect(() => {
    onStep?.(done ? "done" : step);
  }, [onStep, step, done]);

  // El directorio llega sólo cuando hace falta: al entrar al paso de la organización.
  useEffect(() => {
    if (step !== "org" || orgs) return;
    let alive = true;
    fetch("/api/directory")
      .then((r) => (r.ok ? (r.json() as Promise<OrgRow[]>) : Promise.reject()))
      .then((rows) => alive && setOrgs(rows))
      .catch(() => alive && setOrgsFailed(true));
    return () => {
      alive = false;
    };
  }, [step, orgs]);

  const go = (to: number) => {
    moved.current = true;
    setError(null);
    setAt(to);
  };

  function choose(k: Purpose) {
    setPurpose(k);
    onPurpose?.(k);
    // Tocar ya es responder: avanza solo, con un instante para ver lo elegido.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => go(chooseAt + 1), still ? 0 : 180);
  }

  function restart() {
    setPurpose(null);
    onPurpose?.(null);
    go(chooseAt);
  }

  const name = cleanDisplayName(displayName);
  const nameOk = !displayNameInvalid(name);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passOk = !publicPasswordTooShort(password);
  const accountOk = nameOk && emailOk && passOk;

  const hits = useMemo(() => (orgs ? searchDirectory(orgs, query, 6) : []), [orgs, query]);
  const desc = (o: OrgRow) =>
    [t(`type.${o.type}` as DictKey), o.municipality, regionLabel(o.region)].filter(Boolean).join(", ");

  /** A dónde lleva el enlace de confirmación. */
  function destination(): string | undefined {
    if (next) return next;
    if (purpose === "give") return "/?a=needs";
    if (purpose === "org") {
      if (org && org !== "none") return `/c/${encodeURIComponent(org.id)}?gestionar=1`;
      const q = query.trim();
      return q ? `/organizaciones?q=${encodeURIComponent(q)}#buscar` : "/organizaciones#buscar";
    }
    return "/";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== "account") {
      if (step === "org" && !org) return;
      if (step === "name" && !nameOk) {
        setTouched((s) => ({ ...s, name: true }));
        return;
      }
      go(at + 1);
      return;
    }
    setTouched({ name: true, email: true });
    if (busy || !accountOk) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          email: email.trim().toLowerCase(),
          password,
          next: destination(),
          ...(purpose === "give" ? { skills, availability, region: region || undefined } : {}),
          ...(hasAvatar ? { avatar } : {}),
        }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        // La contraseña filtrada y la corta son los únicos casos en que decir la verdad
        // ayuda y no delata nada sobre otras cuentas.
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
      moved.current = true;
      setDone(true);
    } catch {
      setError(t("error.network"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const then = next
      ? null
      : purpose === "org"
        ? org && org !== "none"
          ? t("register.then.orgFound", { org: org.name })
          : t("register.then.orgNew")
        : t(`register.then.${purpose ?? "help"}` as DictKey);
    return (
      <div className="rg-done" role="status">
        {hasAvatar ? (
          // Su personaje saluda: es lo primero que se lleva, y ya es suyo.
          <AvatarCard avatar={avatar} mood="feliz" className="rg-done-ave" />
        ) : (
          <span className="rg-done-ic" aria-hidden="true">
            <Icon.mail width={26} height={26} />
          </span>
        )}
        <h2 ref={heading} tabIndex={-1} className="rg-h">
          {nameOk ? t("register.doneTitleNamed", { name }) : t("register.doneTitle")}
        </h2>
        <p className="rg-p">{t("register.doneBody")}</p>
        {then ? <p className="rg-p rg-p-ink">{then}</p> : null}
        {purpose === "give" && skills.length > 0 ? (
          <p className="rg-p">{t("register.then.giveSaved")}</p>
        ) : null}
        <p className="rg-note">{t("register.doneSpam")}</p>
      </div>
    );
  }

  const chosen = purpose ? PURPOSES.find((p) => p.k === purpose)! : null;
  const ChosenIcon = chosen ? Icon[chosen.icon] : null;
  // Las etapas que se ven arriba. Con una invitación (`next`) no hay perfil que armar.
  const phases: Phase[] = [
    ...(hasAvatar ? (["avatar"] as Phase[]) : []),
    "name",
    ...(next ? [] : (["profile"] as Phase[])),
    "account",
  ];
  const phase = PHASE_OF[step];
  const phaseAt = phases.indexOf(phase);
  // La ficha del personaje, desde que tiene nombre.
  const showMe = phaseAt > phases.indexOf("name") && nameOk;
  const phaseLabel = t("register.phaseOf", {
    n: phaseAt + 1,
    total: phases.length,
    label: t(`register.phase.${phase}` as DictKey),
  });

  return (
    <form className="rg" onSubmit={submit} noValidate>
      <ol className="rg-phases" aria-label={phaseLabel}>
        {phases.map((p, i) => (
          <li
            key={p}
            className={i < phaseAt ? "rg-ph rg-ph-done" : i === phaseAt ? "rg-ph rg-ph-on" : "rg-ph"}
            aria-current={i === phaseAt ? "step" : undefined}
          >
            <span className="rg-ph-dot" aria-hidden="true">
              {i < phaseAt ? <Icon.check width={12} height={12} /> : i + 1}
            </span>
            <span className="rg-ph-n">{t(`register.phase.${p}` as DictKey)}</span>
          </li>
        ))}
      </ol>

      {showMe ? (
        <div className="rg-me">
          {hasAvatar ? (
            <span className="avatar avatar-art rg-me-ave" aria-hidden="true">
              <AvatarDisc avatar={avatar} label={null} />
            </span>
          ) : null}
          <span className="rg-me-txt">
            <b>{name}</b>
            {hasAvatar ? <span>{t(`avatar.sp.${avatar.sp}` as DictKey)}</span> : null}
          </span>
          {hasAvatar ? (
            <button type="button" className="rg-me-x" onClick={() => go(0)}>
              {t("common.edit")}
            </button>
          ) : null}
        </div>
      ) : null}

      {chosen && ChosenIcon && phase === "profile" && step !== "choose" ? (
        /* Lo elegido, con la puerta para cambiarlo: el recorrido depende de esto. */
        <div className="rg-path">
          <span className="rg-path-ic" aria-hidden="true">
            <ChosenIcon width={14} height={14} />
          </span>
          <span className="rg-path-n">{t(`register.p.${chosen.k}` as DictKey)}</span>
          <button type="button" className="rg-path-x" onClick={restart}>
            {t("register.change")}
          </button>
        </div>
      ) : null}

      {/* `key`: cada paso entra con su animación. */}
      <div key={`${purpose}-${step}`} className="rg-body">
        {step === "avatar" ? (
          <>
            <h2 ref={heading} tabIndex={-1} className="rg-h rg-h-big">
              {t("avatar.title")}
            </h2>
            <p className="rg-p">{t("register.avatar.lead", { platform: site.brand.platform })}</p>
            <AvatarEditor value={avatar} onChange={setAvatar} species={fauna} level={1} />
          </>
        ) : null}

        {step === "name" ? (
          <>
            <h2 ref={heading} tabIndex={-1} className="rg-h rg-h-big">
              {t("register.name.title")}
            </h2>
            {hasAvatar ? (
              // El personaje saluda y dice su nombre mientras se escribe.
              <div className="rg-hello">
                <AvatarScene avatar={avatar} mood="feliz" />
                <p className={nameOk ? "rg-bubble" : "rg-bubble rg-bubble-ask"} aria-live="polite">
                  {nameOk ? t("register.name.hello", { name }) : t("register.name.ask")}
                </p>
              </div>
            ) : null}
            <Field label={t("register.displayName")} hint={t("register.name.lead")}>
              <Input
                required
                autoComplete="nickname"
                enterKeyHint="next"
                maxLength={40}
                className="rg-name-in"
                value={displayName}
                aria-invalid={touched.name && !nameOk}
                onBlur={() => displayName && setTouched((s) => ({ ...s, name: true }))}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
            {touched.name && !nameOk ? (
              <p className="lerr" role="alert">
                {t("register.errorName")}
              </p>
            ) : null}
          </>
        ) : null}

        {step === "choose" ? (
          <>
            <h2 ref={heading} tabIndex={-1} className="rg-h">
              {nameOk
                ? t("register.s0named", { platform: site.brand.platform, name })
                : t("register.s0", { platform: site.brand.platform })}
            </h2>
            <div className="rg-opts" role="radiogroup" aria-label={t("register.s0", { platform: site.brand.platform })}>
              {PURPOSES.map(({ k, icon }) => {
                const Ic = Icon[icon];
                const on = purpose === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={on ? "rg-opt rg-opt-on" : "rg-opt"}
                    onClick={() => choose(k)}
                  >
                    <span className="rg-opt-ic" aria-hidden="true">
                      <Ic width={20} height={20} />
                    </span>
                    <span className="rg-opt-txt">
                      <b>{t(`register.p.${k}` as DictKey)}</b>
                      <span>{t(`register.p.${k}Desc` as DictKey)}</span>
                    </span>
                    <Icon.chevron className="rg-opt-go" width={18} height={18} />
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {step === "skills" ? (
          <>
            <h2 ref={heading} tabIndex={-1} className="rg-h">
              {t("register.skills.title")}
            </h2>
            <p className="rg-p">{t("register.skills.lead")}</p>
            <span className="flabel">{t("vol.skills")}</span>
            <ToggleChips
              options={SKILLS}
              value={skills}
              onChange={setSkills}
              label={t("vol.skills")}
              renderLabel={(s) => t(skillLabel(s))}
            />
            <span className="flabel">{t("vol.availability")}</span>
            <ToggleChips
              options={AVAILABILITY}
              value={availability}
              onChange={setAvailability}
              label={t("vol.availability")}
              renderLabel={(a) => t(`vol.av.${a}` as DictKey)}
            />
            <Field
              label={site.country.regionNoun.one.charAt(0).toUpperCase() + site.country.regionNoun.one.slice(1)}
              optional
              optionalLabel={t("common.optional")}
            >
              <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">{t("orgs.reg.regionPick")}</option>
                {site.country.regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="rg-note">{t("vol.hint")}</p>
          </>
        ) : null}

        {step === "org" ? (
          <>
            <h2 ref={heading} tabIndex={-1} className="rg-h">
              {t("register.org.title")}
            </h2>
            <p className="rg-p">{t("register.org.lead")}</p>
            <Field label={t("orgs.findLabel")}>
              <Input
                type="search"
                value={query}
                maxLength={80}
                enterKeyHint="search"
                autoComplete="organization"
                placeholder={t("orgs.findPlaceholder")}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (org !== "none") setOrg(null);
                }}
              />
            </Field>

            {/* Mientras llega el directorio, el hueco de tres resultados. */}
            {!orgs && !orgsFailed && query.trim().length >= 2 ? (
              <div className="rg-orgs" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="skel rg-org-skel" />
                ))}
              </div>
            ) : null}
            {orgsFailed ? <Notice tone="warn">{t("error.network")}</Notice> : null}

            <div className="rg-orgs" role="radiogroup" aria-label={t("register.org.title")} aria-live="polite">
              {hits.map((o) => {
                const on = org !== "none" && org?.id === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={on ? "rg-org rg-org-on" : "rg-org"}
                    onClick={() => setOrg(o)}
                  >
                    <span className="rg-org-txt">
                      <b>{o.name}</b>
                      <span>{desc(o)}</span>
                    </span>
                    <span className="rg-org-mark" aria-hidden="true">
                      {on ? <Icon.check width={14} height={14} /> : null}
                    </span>
                  </button>
                );
              })}
              {orgs && query.trim().length >= 2 && hits.length === 0 ? (
                <p className="rg-p">{t("register.org.none", { q: query.trim() })}</p>
              ) : null}
              {/* Siempre a mano: la suya puede no estar, y eso no frena el registro. */}
              <button
                type="button"
                role="radio"
                aria-checked={org === "none"}
                className={org === "none" ? "rg-org rg-org-new rg-org-on" : "rg-org rg-org-new"}
                onClick={() => setOrg("none")}
              >
                <span className="rg-org-txt">
                  <b>{t("register.org.missing")}</b>
                  <span>{t("register.org.missingDesc")}</span>
                </span>
                <span className="rg-org-mark" aria-hidden="true">
                  {org === "none" ? <Icon.check width={14} height={14} /> : null}
                </span>
              </button>
            </div>
          </>
        ) : null}

        {step === "account" ? (
          <>
            <h2 ref={heading} tabIndex={-1} className="rg-h">
              {nameOk ? t("register.account.titleNamed", { name }) : t("register.account.title")}
            </h2>
            <p className="rg-p">
              {purpose === "org" && org && org !== "none"
                ? t("register.account.leadOrg", { org: org.name })
                : t(`register.account.lead.${next ? "help" : (purpose ?? "help")}` as DictKey)}
            </p>
            <Field label={t("register.email")} hint={t("register.emailHint")}>
              <Input
                required
                type="email"
                inputMode="email"
                autoComplete="email"
                enterKeyHint="next"
                value={email}
                aria-invalid={touched.email && !emailOk}
                onBlur={() => email && setTouched((s) => ({ ...s, email: true }))}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {touched.email && !emailOk ? (
              <p className="lerr" role="alert">
                {t("register.errorEmail")}
              </p>
            ) : null}

            <Field label={t("register.password")}>
              <span className="rg-pass">
                <Input
                  required
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  enterKeyHint="send"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="rg-eye"
                  aria-pressed={show}
                  aria-label={t(show ? "register.hidePass" : "register.showPass")}
                  title={t(show ? "register.hidePass" : "register.showPass")}
                  onClick={() => setShow((v) => !v)}
                >
                  <Icon.eye width={18} height={18} />
                </button>
              </span>
            </Field>
            {/* La regla, a la vista y viva: se marca sola en cuanto se cumple. */}
            <p className={passOk ? "rg-rule rg-rule-ok" : "rg-rule"}>
              <span className="rg-rule-ic" aria-hidden="true">
                <Icon.check width={12} height={12} />
              </span>
              {t("register.passRule", { n: MIN_PASSWORD_PUBLIC })}
            </p>

            {error ? <Notice tone="danger">{error}</Notice> : null}
          </>
        ) : null}
      </div>

      {step !== "choose" || at > 0 ? (
        <div className="rg-nav">
          {at > 0 ? (
            <button
              type="button"
              className="rg-back"
              onClick={() => (steps[at - 1] === "choose" ? restart() : go(at - 1))}
            >
              <Icon.back width={18} height={18} />
              {t("common.back")}
            </button>
          ) : (
            <span />
          )}
          {/* En la pregunta del camino no hay «Continuar»: tocar una opción ya avanza. */}
          {step === "choose" ? null : (
          <Button
            type="submit"
            className="rg-go"
            loading={busy}
            disabled={step === "account" ? !accountOk : step === "org" ? !org : step === "name" ? !nameOk : false}
          >
            {step === "account" ? (
              busy ? (
                t("register.submitting")
              ) : (
                t(purpose === "help" || next ? "register.submit" : "register.submitAndGo")
              )
            ) : (
              <>
                {step === "skills" && skills.length === 0 && availability.length === 0
                  ? t("register.skipForNow")
                  : t("register.next")}
                <Icon.chevron width={18} height={18} />
              </>
            )}
          </Button>
          )}
        </div>
      ) : null}

      {onSignIn ? (
        <p className="rg-have">
          {t("register.haveAccount")}{" "}
          {/* `account.signIn` y no `login.title`: aquel es el rótulo del equipo. */}
          <button type="button" className="linkish" onClick={onSignIn}>
            {t("account.signIn")}
          </button>
        </p>
      ) : null}
    </form>
  );
}
