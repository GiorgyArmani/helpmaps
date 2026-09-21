"use client";

import { useState } from "react";

import { Button, Field, Input, Notice, Spinner, TextArea } from "@/ui/primitives";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";
import { getSupabase } from "@/lib/supabase/client";
import { saveEmergencyArea } from "@/data/emergencies";
import { SEVERITIES, zoneId, type AffectedZone, type Severity } from "@/domain/area";

/**
 * La zona a medio dibujar.
 *
 * Vive en `AppShell` y no acá porque la miran tres sitios a la vez: este formulario, el
 * mapa —que pinta el anillo y escribe en él— y la propia carcasa, que aparta el panel
 * cuando `drawing` está puesto. Un estado que tres piezas necesitan es de la que las
 * contiene a las tres.
 */
export interface ZoneDraft {
  /** La zona existente que se está editando, o null si es nueva. */
  id: string | null;
  label: string;
  severity: Severity;
  note: string;
  /** [lat, lng], orden de Leaflet, anillo abierto. */
  ring: [number, number][];
  /**
   * Con esto puesto, el panel se aparta y el mapa escribe.
   *
   * Son dos modos y no uno porque en un teléfono no caben a la vez: el formulario ocupa
   * la pantalla entera y dibujar necesita ver el mapa entero. Escribir el nombre y marcar
   * el contorno son dos momentos distintos de la misma tarea.
   */
  drawing: boolean;
}

export function newZoneDraft(): ZoneDraft {
  return { id: null, label: "", severity: 2, note: "", ring: [], drawing: false };
}

export function draftFromZone(zone: AffectedZone): ZoneDraft {
  return {
    id: zone.id,
    label: zone.label,
    severity: zone.severity,
    note: zone.note ?? "",
    ring: zone.ring,
    drawing: false,
  };
}

/** Un anillo vale cuando encierra algo. Con dos puntos es una raya. */
const MIN_VERTICES = 3;

/**
 * Las zonas afectadas de esta emergencia: verlas, dibujarlas y corregirlas.
 *
 * ── POR QUÉ ESTO NO ESTÁ EN LA CONSOLA DEL REGISTRO ─────────────────────────
 *
 * Porque se dibuja sobre el mapa, y el mapa está acá. `/emergencias` edita la
 * configuración de un despliegue —su encuadre, sus regiones, su marco legal— y eso se
 * escribe en campos. Un contorno no: se marca con el dedo sobre el sitio del que se está
 * hablando, y cualquier otra forma de meterlo (pares de coordenadas en un textarea) es
 * pedirle a alguien que haga de puente entre un mapa y un formulario en plena emergencia.
 */
export default function ZoneEditor({
  emergencyId,
  zones,
  onZones,
  draft,
  onDraft,
  canWrite,
}: {
  /** La emergencia cuya `area` se escribe. Null en un despliegue servido por preset. */
  emergencyId: string | null;
  zones: AffectedZone[];
  /** Las zonas ya guardadas: el mapa las pinta en cuanto vuelven de la base. */
  onZones: (next: AffectedZone[]) => void;
  draft: ZoneDraft | null;
  onDraft: (next: ZoneDraft | null) => void;
  canWrite: boolean;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un despliegue que todavía sirve el preset compilado no tiene fila donde guardar una
  // zona. Decirlo es más útil que esconder la pestaña: explica qué falta.
  if (!emergencyId) {
    return <Notice tone="info">{t("area.noRow")}</Notice>;
  }

  if (!canWrite) {
    return <Notice tone="info">{t("area.readOnly")}</Notice>;
  }

  async function persist(next: AffectedZone[]) {
    const sb = getSupabase();
    if (!sb || !emergencyId) return;
    setBusy(true);
    setError(null);
    try {
      await saveEmergencyArea(sb, emergencyId, next);
      onZones(next);
      onDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("area.saveError"));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!draft) return;
    const label = draft.label.trim();
    if (!label || draft.ring.length < MIN_VERTICES) return;

    // El id se acuña UNA vez, al crear. Renombrar la zona después no lo mueve: es su
    // identidad, y lo que no se mueve es lo que permite corregir un nombre mal escrito
    // sin que la zona se convierta en otra.
    const taken = new Set(zones.filter((z) => z.id !== draft.id).map((z) => z.id));
    const id = draft.id ?? zoneId(label, taken);
    const zone: AffectedZone = {
      id,
      label,
      severity: draft.severity,
      ring: draft.ring,
      note: draft.note.trim() || undefined,
    };
    const next = zones.some((z) => z.id === id)
      ? zones.map((z) => (z.id === id ? zone : z))
      : [...zones, zone];
    void persist(next);
  }

  function remove(zone: AffectedZone) {
    if (!window.confirm(t("area.deleteConfirm", { name: zone.label }))) return;
    void persist(zones.filter((z) => z.id !== zone.id));
  }

  // ── el formulario de una zona ─────────────────────────────────────────────
  if (draft) {
    const enough = draft.ring.length >= MIN_VERTICES;
    return (
      <div className="zoneform">
        {error ? <Notice tone="danger">{error}</Notice> : null}

        <Field label={t("area.name")} hint={t("area.nameHint")}>
          <Input
            value={draft.label}
            placeholder={t("area.namePlaceholder")}
            onChange={(e) => onDraft({ ...draft, label: e.target.value })}
          />
        </Field>

        <fieldset className="zonesev">
          <legend>{t("area.severity")}</legend>
          {/* Tres botones y no un desplegable: son tres, se ven los tres a la vez y cada
              uno dice su nombre. El color acompaña, nunca informa solo. */}
          <div className="zonesev-row" role="radiogroup" aria-label={t("area.severity")}>
            {SEVERITIES.map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={draft.severity === level}
                className={`zonesev-b zonesev-s${level}${draft.severity === level ? " is-on" : ""}`}
                onClick={() => onDraft({ ...draft, severity: level })}
              >
                <i aria-hidden="true" />
                {t(`area.sev.${level}` as DictKey)}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label={t("area.note")} optional hint={t("area.noteHint")}>
          <TextArea
            rows={2}
            value={draft.note}
            onChange={(e) => onDraft({ ...draft, note: e.target.value })}
          />
        </Field>

        <div className="zonedraw">
          <span className="zonedraw-n">
            {t(draft.ring.length === 1 ? "area.pointOne" : "area.points", {
              n: draft.ring.length,
            })}
          </span>
          <Button variant="ghost" onClick={() => onDraft({ ...draft, drawing: true })}>
            <Icon.target />
            {enough ? t("area.redraw") : t("area.draw")}
          </Button>
        </div>
        {!enough ? <p className="zonehint">{t("area.needPoints")}</p> : null}

        <div className="zoneacts">
          <Button
            block
            loading={busy}
            disabled={!enough || !draft.label.trim()}
            onClick={save}
          >
            {t("common.save")}
          </Button>
          <Button variant="ghost" block onClick={() => onDraft(null)}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  // ── la lista ──────────────────────────────────────────────────────────────
  return (
    <div className="zonelist">
      <p className="zoneintro">{t("area.intro")}</p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {busy ? <Spinner /> : null}

      {zones.length === 0 ? <p className="zoneempty">{t("area.empty")}</p> : null}

      {zones.map((zone) => (
        <div key={zone.id} className="zonerow">
          <span className={`zonedot zonedot-s${zone.severity}`} aria-hidden="true" />
          <div className="zonerow-main">
            <b>{zone.label}</b>
            <span className="zonerow-meta">
              {t(`area.sev.${zone.severity}` as DictKey)} ·{" "}
              {t(zone.ring.length === 1 ? "area.pointOne" : "area.points", {
                n: zone.ring.length,
              })}
            </span>
            {zone.note ? <span className="zonerow-note">{zone.note}</span> : null}
          </div>
          <div className="aacts">
            <button
              type="button"
              className="amini"
              aria-label={t("common.edit")}
              title={t("common.edit")}
              onClick={() => onDraft(draftFromZone(zone))}
            >
              <Icon.pencil />
            </button>
            <button
              type="button"
              className="amini del"
              aria-label={t("common.delete")}
              title={t("common.delete")}
              onClick={() => remove(zone)}
            >
              <Icon.close />
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="addbtn" onClick={() => onDraft(newZoneDraft())}>
        <Icon.plus />
        {t("area.new")}
      </button>
    </div>
  );
}

/**
 * La barra de dibujo: lo único que queda en pantalla mientras se marca el contorno.
 *
 * El panel del equipo es una capa opaca sobre el mapa en un teléfono, así que dibujar con
 * él abierto es imposible: no se ve dónde se está tocando. Mientras dura el trazo, el
 * panel se aparta —sigue montado, sólo oculto, así que al volver está como se dejó— y
 * queda esta barra abajo, que es donde llega el pulgar.
 */
export function ZoneDrawBar({
  draft,
  onDraft,
}: {
  draft: ZoneDraft;
  onDraft: (next: ZoneDraft | null) => void;
}) {
  const { t } = useI18n();
  const n = draft.ring.length;

  return (
    <div className="zonebar" role="region" aria-label={t("area.drawing")}>
      <div className="zonebar-say">
        <b>{draft.label.trim() || t("area.newShort")}</b>
        <span>{n < MIN_VERTICES ? t("area.tapToDraw") : t(n === 1 ? "area.pointOne" : "area.points", { n })}</span>
      </div>
      <div className="zonebar-acts">
        <Button
          variant="ghost"
          disabled={n === 0}
          onClick={() => onDraft({ ...draft, ring: draft.ring.slice(0, -1) })}
        >
          {t("area.undo")}
        </Button>
        <Button onClick={() => onDraft({ ...draft, drawing: false })}>
          {t("area.done")}
        </Button>
      </div>
    </div>
  );
}
