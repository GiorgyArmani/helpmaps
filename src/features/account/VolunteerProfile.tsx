"use client";

import { useState } from "react";
import type { Profile } from "@/domain/account";
import { AVAILABILITY, SKILLS, type Availability, type Skill } from "@/domain/volunteer";
import type { DictKey } from "@/i18n";
import { useI18n } from "@/i18n/context";
import { Icon } from "@/ui/icons";
import { Button } from "@/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";
import { updateMyProfile, volunteerProfileAvailable } from "@/data/account";
import ToggleChips from "@/features/volunteer/ToggleChips";
import { skillLabel } from "@/features/volunteer/EventNeeds";

/**
 * «Cómo puedes ayudar»: lo que sabes hacer y cuándo puedes.
 *
 * Es la mitad del puente que le toca a quien ayuda. Con esto, un evento que busca cocina se
 * lo dice a quien sabe cocinar («Buscan lo que sabes hacer») y la organización sabe, antes
 * de la jornada, a quién poner dónde.
 *
 * Plegado cuando ya está dicho: se lee como una línea de etiquetas y se cambia con «Elegir».
 * Se guarda con un botón y no a cada toque: marcar cuatro oficios con mala señal serían
 * cuatro viajes, y cualquiera que falle dejaría la lista a medias sin que se note.
 */
export default function VolunteerProfile({ profile, onSaved }: { profile: Profile | null; onSaved: () => void }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [busy, setBusy] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [ok, setOk] = useState(false);

  // Sin la migración, o sin fila de perfil (hace falta un nombre para crearla), no se ofrece
  // un editor que no podría guardar.
  if (!profile || !volunteerProfileAvailable()) return null;

  const has = profile.skills.length > 0 || profile.availability.length > 0;

  function abrir() {
    setSkills(profile!.skills);
    setAvailability(profile!.availability);
    setFallo(false);
    setOk(false);
    setEditing(true);
  }

  async function guardar() {
    const sb = getSupabase();
    if (!sb || busy) return;
    setBusy(true);
    setFallo(false);
    try {
      await updateMyProfile(sb, { skills, availability });
      setEditing(false);
      setOk(true);
      onSaved();
    } catch {
      setFallo(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="acc-sec">
      <div className="vprof-head">
        <h3 className="acc-h">{t("vol.title")}</h3>
        {!editing ? (
          <button type="button" className="vprof-edit" onClick={abrir}>
            <Icon.pencil />
            {t("vol.edit")}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="vprof-form">
          <p className="fhint">{t("vol.hint")}</p>
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
          {fallo ? (
            <p className="lerr" role="alert">
              {t("admin.saveError")}
            </p>
          ) : null}
          <div className="acc-rename-row">
            <Button type="button" loading={busy} onClick={() => void guardar()}>
              {busy ? t("common.saving") : t("common.save")}
            </Button>
            <button type="button" className="linkish" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : has ? (
        <div className="vprof-tags">
          {profile.skills.map((s) => (
            <span key={s} className="dtag">
              {t(skillLabel(s))}
            </span>
          ))}
          {profile.availability.map((a) => (
            <span key={a} className="dtag vprof-when">
              <Icon.clock />
              {t(`vol.av.${a}` as DictKey)}
            </span>
          ))}
        </div>
      ) : (
        <p className="acc-empty">{t("vol.empty")}</p>
      )}
      {ok && !editing ? (
        <p className="acc-ok" role="status">
          {t("vol.saved")}
        </p>
      ) : null}
    </section>
  );
}
