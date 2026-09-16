"use client";

import { useState } from "react";
import { toCenterStatus, type Center } from "@/domain/types";
import { saveCenterProfile, type CenterProfile } from "@/data/initiatives";
import { hasHours } from "@/domain/hours";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { getSupabase } from "@/lib/supabase/client";
import { BRAND } from "@/config";
import { useSiteHelpers } from "@/features/app/SiteProvider";
import HoursPicker from "@/features/centers/HoursPicker";
import HoursView, { scheduleText } from "@/features/centers/HoursView";
import SupplyPicker from "@/features/centers/SupplyPicker";
import SupplyQuickAdd from "@/features/centers/SupplyQuickAdd";
import { instagramUrl } from "@/features/centers/coverage";
import { Field } from "./forms";

/**
 * La pestaña «Información» del perfil, con cada bloque editable donde está.
 *
 * ── POR QUÉ EN SU SITIO Y NO UN FORMULARIO ─────────────────────────────────
 *
 * El panel de antes era un formulario largo plegado al final: para cambiar el horario había
 * que abrir «ver y corregir», bajar entre doce campos y guardar todo. Nadie vuelve a una
 * pantalla así, y el perfil se quedaba como lo dejó el onboarding.
 *
 * Aquí cada bloque se ve como lo ve el público y lleva su lápiz. Tocarlo abre sólo ESE
 * bloque, se guarda sólo eso y se cierra. Es el gesto de cualquier red social con tu propio
 * perfil delante, y el que hace que corregir una cosa cueste un toque.
 *
 * Un solo bloque abierto a la vez, y no por estética: cada guardado escribe la fila entera
 * de `center_info` a partir de lo último leído. Dos bloques abiertos a la vez podían pisarse.
 */

export type SectionId = "needs" | "about" | "hours" | "receives" | "contact" | "donate";

interface SectionProps {
  profile: CenterProfile;
  editable: boolean;
  editing: SectionId | null;
  setEditing: (id: SectionId | null) => void;
  onSaved: () => void;
}

export function InfoSections({ center, ...p }: SectionProps & { center: Center }) {
  const { t, lang } = useI18n();
  const helpers = useSiteHelpers();
  const { profile, editable } = p;

  const place = [center.municipality, helpers.regionLabel(center.region)].filter(Boolean).join(", ");
  const hayContacto = Boolean(profile.contact_name || profile.website || profile.instagram);

  return (
    <div className="ecards">
      <EditableCard
        id="needs"
        title={t("pedit.secNeeds")}
        empty={!profile.needs}
        emptyLabel={t("pedit.emptyNeeds")}
        {...p}
        view={
          <div className="dneed">
            <p className="dneed-t">{profile.needs}</p>
          </div>
        }
        form={(done) => <NeedsForm profile={profile} onDone={done} />}
      />

      <EditableCard
        id="about"
        title={t("pedit.secAbout")}
        empty={!profile.description && !profile.category}
        emptyLabel={t("pedit.emptyAbout")}
        {...p}
        view={
          <>
            {profile.category ? <span className="dtag">{profile.category}</span> : null}
            {profile.description ? <p className="ecard-text">{profile.description}</p> : null}
          </>
        }
        form={(done) => <AboutForm profile={profile} onDone={done} />}
      />

      <EditableCard
        id="hours"
        title={t("pedit.secHours")}
        empty={!hasHours(profile.hours) && !profile.schedule}
        emptyLabel={t("pedit.emptyHours")}
        {...p}
        view={
          <HoursView
            hours={profile.hours}
            schedule={profile.schedule}
            status={toCenterStatus(profile.status)}
            t={t}
            lang={lang}
          />
        }
        form={(done) => <HoursForm profile={profile} onDone={done} />}
      />

      <EditableCard
        id="receives"
        title={t("pedit.secReceives")}
        empty={profile.receives.length === 0}
        emptyLabel={t("pedit.emptyReceives")}
        {...p}
        view={
          <div className="dtags">
            {profile.receives.map((r) => (
              <span key={r} className="dtag">
                {r}
              </span>
            ))}
          </div>
        }
        form={(done) => <ReceivesForm profile={profile} onDone={done} />}
      />

      <EditableCard
        id="contact"
        title={t("pedit.secContact")}
        empty={!hayContacto}
        emptyLabel={t("pedit.emptyContact")}
        {...p}
        view={
          <div className="drows">
            {profile.contact_name ? (
              <div className="drow">
                <span className="dlabel">{t("center.responsible")}</span>
                <span className="dval">{profile.contact_name}</span>
              </div>
            ) : null}
            {profile.website ? (
              <div className="drow">
                <span className="dlabel">{t("center.website")}</span>
                <span className="dval">
                  <a href={profile.website} target="_blank" rel="noopener noreferrer">
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                </span>
              </div>
            ) : null}
            {profile.instagram ? (
              <div className="drow">
                <span className="dlabel">{t("center.instagram")}</span>
                <span className="dval">
                  <a href={instagramUrl(profile.instagram)} target="_blank" rel="noopener noreferrer">
                    @{profile.instagram}
                  </a>
                </span>
              </div>
            ) : null}
          </div>
        }
        form={(done) => <ContactForm profile={profile} onDone={done} />}
      />

      <EditableCard
        id="donate"
        title={t("pedit.secDonate")}
        empty={!profile.donate_info && !profile.donate_url}
        emptyLabel={t("pedit.emptyDonate")}
        {...p}
        view={
          <>
            {profile.donate_info ? <p className="ecard-text ecard-pre">{profile.donate_info}</p> : null}
            {profile.donate_url ? (
              <a className="ecard-link" href={profile.donate_url} target="_blank" rel="noopener noreferrer">
                <Icon.link />
                {profile.donate_url.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </>
        }
        form={(done) => <DonateForm profile={profile} onDone={done} />}
      />

      {/* Lo que la organización NO corrige sola, a la vista y con el motivo. Decirlo aquí
          evita que alguien lo busque, no lo encuentre y crea que el perfil está roto. */}
      <section className="ecard">
        <div className="ecard-head">
          <h3 className="ecard-title">{t("pedit.secPlace")}</h3>
        </div>
        <div className="drows">
          <div className="drow">
            <span className="dlabel">{t("form.type")}</span>
            <span className="dval">{t(`type.${center.type}` as "type.iniciativa")}</span>
          </div>
          {place ? (
            <div className="drow">
              <span className="dlabel">{t("form.region")}</span>
              <span className="dval">{place}</span>
            </div>
          ) : null}
          {center.address ? (
            <div className="drow">
              <span className="dlabel">{t("form.address")}</span>
              <span className="dval">{center.address}</span>
            </div>
          ) : null}
          {center.phone ? (
            <div className="drow">
              <span className="dlabel">{t("center.call")}</span>
              <span className="dval">{center.phone}</span>
            </div>
          ) : null}
        </div>
        {editable ? (
          <p className="ecard-lock">
            <Icon.lock />
            {t("pedit.placeLocked", { platform: BRAND.platform })}
          </p>
        ) : null}
      </section>
    </div>
  );
}

// ── La tarjeta ─────────────────────────────────────────────────────────────

function EditableCard({
  id,
  title,
  empty,
  emptyLabel,
  view,
  form,
  editable,
  editing,
  setEditing,
  onSaved,
}: SectionProps & {
  id: SectionId;
  title: string;
  empty: boolean;
  emptyLabel: string;
  view: React.ReactNode;
  form: (done: (saved: boolean) => void) => React.ReactNode;
}) {
  const { t } = useI18n();
  const abierta = editing === id;

  // En la vista pública un bloque vacío no se dibuja: es lo que vería cualquiera.
  if (!editable && empty) return null;

  const done = (saved: boolean) => {
    setEditing(null);
    if (saved) onSaved();
  };

  return (
    <section className={`ecard${abierta ? " ecard-open" : ""}`}>
      <div className="ecard-head">
        <h3 className="ecard-title">{title}</h3>
        {editable && !abierta && !empty ? (
          <button
            type="button"
            className="ecard-edit"
            aria-label={t("pedit.editSection", { section: title })}
            title={t("pedit.editSection", { section: title })}
            onClick={() => setEditing(id)}
          >
            <Icon.pencil />
          </button>
        ) : null}
      </div>

      {abierta ? (
        form(done)
      ) : empty ? (
        // Vacío y editable: el hueco ES la invitación a rellenarlo, como el «añade una
        // biografía» de un perfil recién creado.
        <button type="button" className="ecard-empty" onClick={() => setEditing(id)}>
          <Icon.plus />
          {emptyLabel}
        </button>
      ) : (
        <div className="ecard-body">{view}</div>
      )}
    </section>
  );
}

// ── Guardar un trozo ───────────────────────────────────────────────────────

function useSave(profile: CenterProfile, onDone: (saved: boolean) => void) {
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState(false);

  async function save(patch: Partial<CenterProfile>) {
    const sb = getSupabase();
    if (!sb) return;
    setGuardando(true);
    setFallo(false);
    try {
      await saveCenterProfile(sb, { ...profile, ...patch });
      onDone(true);
    } catch {
      // Se queda abierto con lo escrito: reintentar es un toque, y perder lo escrito por
      // una barra de cobertura sería la razón para no volver a intentarlo.
      setFallo(true);
    } finally {
      setGuardando(false);
    }
  }

  return { guardando, fallo, save };
}

function FormActions({
  guardando,
  fallo,
  onSave,
  onCancel,
  disabled,
}: {
  guardando: boolean;
  fallo: boolean;
  onSave: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <>
      {fallo ? (
        <p className="onb-err" role="status">
          {t("error.generic")}
        </p>
      ) : null}
      <div className="ecard-acts">
        <button type="button" className="btng" onClick={onCancel} disabled={guardando}>
          {t("pedit.cancel")}
        </button>
        <button type="button" className="btnp" onClick={onSave} disabled={guardando || disabled}>
          {guardando ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </>
  );
}

type FormProps = { profile: CenterProfile; onDone: (saved: boolean) => void };

function NeedsForm({ profile, onDone }: FormProps) {
  const { t } = useI18n();
  const [needs, setNeeds] = useState(profile.needs ?? "");
  const s = useSave(profile, onDone);
  return (
    <div className="stack">
      <textarea
        className="finput"
        rows={3}
        value={needs}
        onChange={(e) => setNeeds(e.target.value)}
        maxLength={400}
        placeholder={t("onb.f.needsHint")}
        aria-label={t("pedit.secNeeds")}
      />
      <SupplyQuickAdd value={needs} onChange={setNeeds} />
      <FormActions {...s} onSave={() => void s.save({ needs: needs.trim() || null })} onCancel={() => onDone(false)} />
    </div>
  );
}

function AboutForm({ profile, onDone }: FormProps) {
  const { t } = useI18n();
  const [category, setCategory] = useState(profile.category ?? "");
  const [description, setDescription] = useState(profile.description ?? "");
  const s = useSave(profile, onDone);
  return (
    <div className="stack">
      <Field label={t("onb.f.category")} hint={t("onb.f.categoryHint")}>
        <input className="finput" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} />
      </Field>
      <Field label={t("onb.f.description")} hint={t("onb.f.descriptionHint")}>
        <textarea
          className="finput"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={600}
        />
      </Field>
      <FormActions
        {...s}
        onSave={() =>
          void s.save({ category: category.trim() || null, description: description.trim() || null })
        }
        onCancel={() => onDone(false)}
      />
    </div>
  );
}

function HoursForm({ profile, onDone }: FormProps) {
  const [hours, setHours] = useState(profile.hours);
  const s = useSave(profile, onDone);
  const invalido = Object.values(hours?.days ?? {}).some((list) => list?.some((sh) => sh[0] === sh[1]));
  return (
    <div className="stack">
      <HoursPicker value={hours} onChange={setHours} legacyText={profile.schedule} />
      <FormActions
        {...s}
        disabled={invalido}
        onSave={() =>
          void s.save({
            hours,
            // Sin nada marcado se conserva el texto de antes: borrar los días no debería
            // borrar también lo que estaba escrito a mano.
            schedule: scheduleText(hours) ?? profile.schedule,
          })
        }
        onCancel={() => onDone(false)}
      />
    </div>
  );
}

function ReceivesForm({ profile, onDone }: FormProps) {
  const [receives, setReceives] = useState(profile.receives);
  const s = useSave(profile, onDone);
  return (
    <div className="stack">
      <SupplyPicker value={receives} onChange={setReceives} />
      <FormActions {...s} onSave={() => void s.save({ receives })} onCancel={() => onDone(false)} />
    </div>
  );
}

function ContactForm({ profile, onDone }: FormProps) {
  const { t } = useI18n();
  const [contact, setContact] = useState(profile.contact_name ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [instagram, setInstagram] = useState(profile.instagram ?? "");
  const s = useSave(profile, onDone);
  return (
    <div className="stack">
      <Field label={t("onb.f.contact")} hint={t("onb.f.contactHint")}>
        <input className="finput" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={80} />
      </Field>
      <Field label={t("center.website")}>
        <input
          className="finput"
          inputMode="url"
          placeholder="https://"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </Field>
      <Field label={t("onb.f.instagram")}>
        <input
          className="finput"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))}
          maxLength={40}
        />
      </Field>
      <FormActions
        {...s}
        onSave={() =>
          void s.save({
            contact_name: contact.trim() || null,
            website: website.trim() || null,
            instagram: instagram.trim() || null,
          })
        }
        onCancel={() => onDone(false)}
      />
    </div>
  );
}

function DonateForm({ profile, onDone }: FormProps) {
  const { t } = useI18n();
  const [info, setInfo] = useState(profile.donate_info ?? "");
  const [url, setUrl] = useState(profile.donate_url ?? "");
  const s = useSave(profile, onDone);
  return (
    <div className="stack">
      <Field label={t("onb.f.donateInfo")} hint={t("onb.f.donateInfoHint")}>
        <textarea className="finput" rows={4} value={info} onChange={(e) => setInfo(e.target.value)} maxLength={600} />
      </Field>
      <Field label={t("onb.f.donateUrl")}>
        <input
          className="finput"
          inputMode="url"
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>
      <p className="fhint">
        <Icon.alert /> {t("onb.moneyNote", { platform: BRAND.platform })}
      </p>
      <FormActions
        {...s}
        onSave={() => void s.save({ donate_info: info.trim() || null, donate_url: url.trim() || null })}
        onCancel={() => onDone(false)}
      />
    </div>
  );
}
