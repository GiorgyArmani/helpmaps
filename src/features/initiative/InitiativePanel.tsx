"use client";

import { useCallback, useEffect, useState } from "react";
import type { Center } from "@/domain/types";
import {
  EMPTY_PROFILE,
  emptyProfile,
  fetchCenterProfile,
  fetchInitiativeProfile,
  saveCenterProfile,
  type CenterProfile,
  type InitiativeProfile,
} from "@/data/initiatives";
import { Icon } from "@/ui/icons";
import { PanelSkeleton } from "@/ui/Skeleton";
import SupplyQuickAdd from "@/features/centers/SupplyQuickAdd";
import ManagePanel from "./ManagePanel";
import { Field } from "./forms";
import { useI18n } from "@/i18n/context";
import { getSupabase } from "@/lib/supabase/client";
import { BRAND } from "@/config";

/**
 * «Mi iniciativa»: lo que ve quien gestiona un punto.
 *
 * DOS CARAS, Y LA PRIMERA NO ES UN TRÁMITE. Mientras `center_info.onboarded_at` esté
 * vacío se muestra el onboarding; después, el panel de gestión.
 *
 * El onboarding existe porque alguien a quien acaban de dar las llaves de su punto llega
 * con todo en la cabeza —el horario, qué hace falta, por dónde recibe— y ése es el único
 * momento en que lo va a escribir entero. Dejarle entrar a un panel vacío con un botón de
 * «editar perfil» gasta esa oportunidad, y el perfil se queda a medias para siempre.
 *
 * Por eso los pasos guardan según se avanza y no al final: quien se quede a mitad deja
 * escrito lo que ya contestó, y al volver sigue donde estaba en vez de empezar de cero.
 *
 * Va DENTRO del panel del mapa, como todo lo demás. No es una página aparte.
 */
export default function InitiativePanel({
  center,
  onClose,
}: {
  center: Center;
  onClose: () => void;
}) {
  const { t } = useI18n();
  // Si no hay cliente configurado no hay nada que esperar, y el primer render ya lo sabe.
  // Arrancar en `loading: true` y corregirlo desde el efecto dejaba el panel entero en
  // «Cargando…» para siempre — la peor forma posible de decir «esto no está configurado».
  const configurado = getSupabase() !== null;
  const [profile, setProfile] = useState<CenterProfile | null>(() =>
    configurado ? null : emptyProfile(center.id),
  );
  const [content, setContent] = useState<InitiativeProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(configurado);

  // Recargar es pedir OTRA vuelta del efecto, no hacer el trabajo aparte.
  //
  // Tener una función async que escribe estado y llamarla desde el efecto Y desde los
  // formularios daba dos caminos hacia las mismas tres escrituras, y el de guardar no
  // cancelaba nada. Con un contador, la carga vive en un solo sitio —el efecto— y
  // «guardado» sólo dice «vuelve a mirar».
  const [vuelta, setVuelta] = useState(0);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);

  useEffect(() => {
    const sb = getSupabase();
    // Sin cliente no hay nada que pedir: el estado inicial de arriba ya deja el panel
    // utilizable.
    if (!sb) return;
    let vivo = true;
    void Promise.all([
      fetchCenterProfile(sb, center.id),
      fetchInitiativeProfile(sb, center.id),
    ]).then(([p, c]) => {
      if (!vivo) return;
      setProfile(p ?? emptyProfile(center.id));
      setContent(c);
      setLoading(false);
    });
    return () => {
      vivo = false;
    };
  }, [center.id, vuelta]);

  if (loading) return <PanelSkeleton />;
  if (!profile) return <p className="empty">{t("error.generic")}</p>;

  return (
    <div className="mine">
      <button type="button" className="cdback" onClick={onClose}>
        <Icon.back />
        <span>{t("common.back")}</span>
      </button>

      <div className="mine-head">
        <span className="mine-kicker">{t("mine.kicker")}</span>
        <h2 className="mine-name">{center.name}</h2>
      </div>

      {profile.onboarded_at ? (
        <ManagePanel center={center} profile={profile} content={content} onSaved={recargar} />
      ) : (
        <Onboarding center={center} profile={profile} onDone={recargar} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Onboarding
// ───────────────────────────────────────────────────────────────────────────

const PASOS = 3;

function Onboarding({
  center,
  profile,
  onDone,
}: {
  center: Center;
  profile: CenterProfile;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [paso, setPaso] = useState(1);
  const [borrador, setBorrador] = useState<CenterProfile>(profile);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CenterProfile>(k: K, v: CenterProfile[K]) =>
    setBorrador((b) => ({ ...b, [k]: v }));

  async function avanzar() {
    const sb = getSupabase();
    if (!sb) return;
    const ultimo = paso === PASOS;
    setGuardando(true);
    setError(null);
    try {
      // Se guarda en CADA paso, no sólo al final: quien pierde la señal a mitad —que en
      // este país es lo normal— no puede perder lo que ya escribió.
      await saveCenterProfile(sb, borrador, ultimo);
      if (ultimo) onDone();
      else setPaso((p) => p + 1);
    } catch {
      setError(t("error.generic"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="onb">
      <div className="onb-steps" aria-label={t("onb.stepOf", { n: paso, total: PASOS })}>
        {Array.from({ length: PASOS }, (_, i) => (
          <span key={i} className={`onb-step${i < paso ? " onb-step-on" : ""}`} />
        ))}
      </div>

      {paso === 1 ? (
        <>
          <h3 className="onb-t">{t("onb.s1.title")}</h3>
          <p className="onb-p">{t("onb.s1.body")}</p>
          <Field label={t("onb.f.category")} hint={t("onb.f.categoryHint")}>
            <input
              className="finput"
              value={borrador.category ?? ""}
              onChange={(e) => set("category", e.target.value || null)}
              maxLength={60}
            />
          </Field>
          <Field label={t("onb.f.description")} hint={t("onb.f.descriptionHint")}>
            <textarea
              className="finput"
              rows={4}
              value={borrador.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              maxLength={600}
            />
          </Field>
        </>
      ) : null}

      {paso === 2 ? (
        <>
          <h3 className="onb-t">{t("onb.s2.title")}</h3>
          <p className="onb-p">{t("onb.s2.body")}</p>
          <Field label={t("onb.f.schedule")} hint={t("onb.f.scheduleHint")}>
            <input
              className="finput"
              value={borrador.schedule ?? ""}
              onChange={(e) => set("schedule", e.target.value || null)}
              maxLength={120}
            />
          </Field>
          <Field label={t("onb.f.contact")} hint={t("onb.f.contactHint")}>
            <input
              className="finput"
              value={borrador.contact_name ?? ""}
              onChange={(e) => set("contact_name", e.target.value || null)}
              maxLength={80}
            />
          </Field>
          <Field label={t("onb.f.needs")} hint={t("onb.f.needsHint")}>
            <textarea
              className="finput"
              rows={3}
              value={borrador.needs ?? ""}
              onChange={(e) => set("needs", e.target.value || null)}
              maxLength={400}
            />
          </Field>
          <SupplyQuickAdd
            value={borrador.needs ?? ""}
            onChange={(next) => set("needs", next || null)}
          />
        </>
      ) : null}

      {paso === 3 ? (
        <>
          <h3 className="onb-t">{t("onb.s3.title")}</h3>
          <p className="onb-p">{t("onb.s3.body")}</p>
          <Field label={t("onb.f.donateInfo")} hint={t("onb.f.donateInfoHint")}>
            <textarea
              className="finput"
              rows={4}
              value={borrador.donate_info ?? ""}
              onChange={(e) => set("donate_info", e.target.value || null)}
              maxLength={600}
            />
          </Field>
          <Field label={t("onb.f.donateUrl")}>
            <input
              className="finput"
              inputMode="url"
              placeholder="https://"
              value={borrador.donate_url ?? ""}
              onChange={(e) => set("donate_url", e.target.value || null)}
            />
          </Field>
          <Field label={t("onb.f.instagram")}>
            <input
              className="finput"
              value={borrador.instagram ?? ""}
              onChange={(e) => set("instagram", e.target.value.replace(/^@/, "") || null)}
              maxLength={40}
            />
          </Field>

          {/* La regla del dinero, dicha a quien la necesita oír: la plataforma no se pone
              en medio. Va aquí y no sólo en la ficha pública porque es la persona que
              publica los datos de cobro quien tiene que saber a dónde llega el dinero. */}
          <p className="onb-note">
            <Icon.alert />
            {t("onb.moneyNote", { platform: BRAND.platform })}
          </p>
        </>
      ) : null}

      {error ? (
        <p className="onb-err" role="status">
          {error}
        </p>
      ) : null}

      <div className="onb-actions">
        {paso > 1 ? (
          <button type="button" className="btng" onClick={() => setPaso((p) => p - 1)}>
            {t("onb.back")}
          </button>
        ) : null}
        <button type="button" className="btnp" onClick={() => void avanzar()} disabled={guardando}>
          {guardando
            ? t("common.saving")
            : paso === PASOS
              ? t("onb.finish")
              : t("onb.next")}
        </button>
      </div>

      <p className="onb-skip">{t("onb.savedAsYouGo", { name: center.name })}</p>
    </section>
  );
}
