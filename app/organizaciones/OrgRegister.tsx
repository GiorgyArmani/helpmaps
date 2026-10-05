"use client";

import { useEffect, useRef, useState } from "react";
import type { LocationType } from "@/domain/types";
import type { DictKey } from "@/i18n";
import { useI18n } from "@/i18n/context";
import { typeStyle } from "@/config";
import { Button, Field, Input, Notice, Select, TextArea } from "@/ui/primitives";
import { Icon } from "@/ui/icons";
import { glyphSvg } from "@/features/map/pinGlyphs";
import PrivacyNotice from "@/features/suggest/PrivacyNotice";
import { enqueue } from "@/features/suggest/offlineQueue";
import { useSite, useSiteHelpers } from "@/features/app/SiteProvider";

const STEPS = 3;

/**
 * Registrar la organización sin salir de `/organizaciones`: si el buscador no la encuentra,
 * el alta está ahí mismo, con el nombre que se acaba de escribir. Mandar a la persona a
 * la app para «sugerir un punto» la sacaba de la página justo cuando ya había decidido.
 *
 * ── EN TRES PASOS ───────────────────────────────────────────────────────────
 *
 * Qué es, dónde está y cómo escribirte: pocas cosas por pantalla, en un teléfono, con el
 * pulgar. Siete campos de golpe parecían un trámite; tres preguntas cortas, una
 * conversación. El tipo se elige tocando (con el mismo icono que tendrá en el mapa), no
 * en una lista desplegable.
 *
 * ── NO ESCRIBE EL MAPA ──────────────────────────────────────────────────────
 *
 * Va a la misma cola de moderación que `SuggestForm` (`/api/suggest`): una persona del
 * equipo lo revisa, lo publica y, con el contacto, le da acceso a quien lo pidió. Por eso
 * el contacto es obligatorio aquí y no en el formulario general: sin él no hay a quién
 * darle la organización.
 */
export default function OrgRegister({ initialName, onCancel }: { initialName: string; onCancel?: () => void }) {
  const { t } = useI18n();
  const site = useSite();
  const types = useSiteHelpers().pinTypes();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<LocationType | null>(null);
  const [region, setRegion] = useState("");
  const [place, setPlace] = useState("");
  const [contact, setContact] = useState("");
  const [who, setWho] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "queued" | "error" | "limited">("idle");
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Al cambiar de paso, el foco va a su pregunta: el lector de pantalla la anuncia y el
  // teclado sigue desde ahí. No al montar: no se le roba el foco al buscador.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [step]);

  const canNext = [name.trim().length >= 2 && type !== null, true, contact.trim().length >= 5][step];
  const go = (to: number) => {
    moved.current = true;
    setStep(to);
  };
  const regionNoun = site.country.regionNoun.one;
  const Region = regionNoun.charAt(0).toUpperCase() + regionNoun.slice(1);

  async function send() {
    if (state === "sending" || !type) return;
    setState("sending");
    const regionName = site.country.regions.find((r) => r.code === region)?.name ?? "";
    // Lo que el equipo lee en su panel: una línea por dato, en el idioma de quien escribe.
    const message = [
      t("orgs.reg.msgIntro"),
      `${t("orgs.reg.name")}: ${name.trim()}`,
      `${t("orgs.reg.type")}: ${t(`type.${type}` as DictKey)}`,
      regionName ? `${Region}: ${regionName}` : "",
      place.trim() ? `${t("orgs.reg.place")}: ${place.trim()}` : "",
      notes.trim() ? `${t("orgs.reg.notes")}: ${notes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const sub = {
      kind: type === "iniciativa" ? ("initiative" as const) : ("center" as const),
      message,
      name: who.trim() || null,
      contact: contact.trim(),
      payload: null,
    };
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (res.status === 429) return setState("limited");
      setState(res.ok ? "done" : "error");
    } catch {
      // Sin señal a mitad del envío: se guarda y sale cuando vuelva (`offlineQueue`).
      enqueue(sub);
      setState("queued");
    }
  }

  // «Intro» en un campo avanza, como el botón; en el último paso, envía.
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canNext) return;
    if (step < STEPS - 1) go(step + 1);
    else void send();
  }

  if (state === "done" || state === "queued") {
    return (
      <div className="olp-reg olp-reg-done" role="status">
        <span className="olp-reg-ok" aria-hidden="true">
          <Icon.check width={24} height={24} />
        </span>
        <h3 className="olp-reg-h">{t("orgs.reg.doneTitle", { name: name.trim() })}</h3>
        <p className="olp-reg-p">
          {state === "queued" ? t("offline.queued") : t("orgs.reg.doneBody", { contact: contact.trim() })}
        </p>
      </div>
    );
  }

  const titles = [t("orgs.reg.s1"), t("orgs.reg.s2"), t("orgs.reg.s3")];

  return (
    <form id="registrar" className="olp-reg" onSubmit={submit} noValidate>
      <p className="olp-reg-kicker">{t("orgs.reg.title")}</p>

      {/* El avance: tres tramos que se llenan. La cifra, para quien no ve el color. */}
      <div className="olp-regbars" aria-hidden="true">
        {titles.map((_, i) => (
          <span key={i} className={i <= step ? "olp-regbar olp-regbar-on" : "olp-regbar"} />
        ))}
      </div>
      <p className="olp-reg-count">{t("orgs.reg.stepOf", { n: step + 1, total: STEPS })}</p>

      <h3 ref={heading} tabIndex={-1} className="olp-reg-h">
        {titles[step]}
      </h3>

      {/* `key`: cada paso entra con su propia animación. */}
      <div key={step} className="olp-reg-body stack">
        {step === 0 ? (
          <>
            <Field label={t("orgs.reg.name")}>
              <Input
                value={name}
                required
                maxLength={80}
                autoComplete="organization"
                enterKeyHint="next"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <fieldset className="olp-types">
              <legend className="flabel">{t("orgs.reg.type")}</legend>
              <div className="olp-types-grid" role="radiogroup">
                {types.map((k) => {
                  const st = typeStyle(k);
                  const on = type === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={on ? "olp-type olp-type-on" : "olp-type"}
                      style={{ ["--tc" as string]: st.color }}
                      onClick={() => setType(k)}
                    >
                      {/* El icono del mapa: SVG propio de `pinGlyphs`, no texto de nadie. */}
                      <span
                        className="olp-type-ic"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: glyphSvg(st.icon, 18) }}
                      />
                      <span className="olp-type-n">{t(`type.${k}` as DictKey)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <p className="olp-reg-p">{t("orgs.reg.s2Lead")}</p>
            <Field label={Region} optional optionalLabel={t("common.optional")}>
              <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">{t("orgs.reg.regionPick")}</option>
                {site.country.regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("orgs.reg.place")} optional optionalLabel={t("common.optional")}>
              <Input value={place} maxLength={160} enterKeyHint="next" onChange={(e) => setPlace(e.target.value)} />
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field label={t("orgs.reg.contact")} hint={t("orgs.reg.contactHint")}>
              <Input
                value={contact}
                required
                maxLength={120}
                autoComplete="email"
                enterKeyHint="send"
                onChange={(e) => setContact(e.target.value)}
              />
            </Field>
            <Field label={t("suggest.name")} optional optionalLabel={t("common.optional")}>
              <Input value={who} maxLength={80} autoComplete="name" onChange={(e) => setWho(e.target.value)} />
            </Field>
            <Field label={t("orgs.reg.notes")} optional optionalLabel={t("common.optional")}>
              <TextArea value={notes} rows={2} maxLength={600} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <PrivacyNotice />
            {state === "error" ? <Notice tone="danger">{t("suggest.error")}</Notice> : null}
            {state === "limited" ? <Notice tone="warn">{t("suggest.tooMany")}</Notice> : null}
          </>
        ) : null}
      </div>

      <div className="olp-reg-nav">
        {step > 0 ? (
          <button type="button" className="olp-reg-back" onClick={() => go(step - 1)}>
            <Icon.back width={18} height={18} />
            {t("common.back")}
          </button>
        ) : onCancel ? (
          <button type="button" className="olp-reg-back" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        ) : (
          <span />
        )}
        <Button type="submit" className="olp-reg-go" loading={state === "sending"} disabled={!canNext}>
          {step < STEPS - 1 ? (
            <>
              {t("orgs.reg.next")}
              <Icon.chevron width={18} height={18} />
            </>
          ) : state === "sending" ? (
            t("suggest.sending")
          ) : (
            t("orgs.reg.submit")
          )}
        </Button>
      </div>
    </form>
  );
}
