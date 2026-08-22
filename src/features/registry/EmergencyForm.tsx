"use client";

import { useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/ui/primitives";
import { JsonField } from "@/features/registry/JsonField";
import type { EmergencyDraft } from "@/data/emergencies";
import type { EmergencyRow } from "@/config/fromRow";

const HAZARDS = ["earthquake", "flood", "storm", "fire", "landslide", "conflict", "other"];

/** A new emergency, valid enough to save as a draft and fill in from there. */
export function blankEmergency(): EmergencyDraft {
  return {
    slug: "",
    host: null,
    country_code: "",
    country_name: "",
    name: "",
    hazard_type: "earthquake",
    status: "draft",
    region_noun: { one: "región", many: "regiones" },
    geo: {
      center: [0, 0],
      zoom: 6,
      regionZoom: 9,
      bounds: [
        [-10, -80],
        [15, -60],
      ],
      geocodeCountry: "",
    },
    regions: [],
    legal: { controller: "", privacyEmail: "", dataLaw: "", jurisdiction: "" },
    brand: {},
    features: {},
    language: {},
    hazard: {},
    layers: [],
    news: {},
    maintenance: false,
    notice: null,
  };
}

export default function EmergencyForm({
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
  canWrite,
}: {
  draft: EmergencyDraft;
  onChange: (next: EmergencyDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  canWrite: boolean;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const set = <K extends keyof EmergencyDraft>(key: K, value: EmergencyDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const problems = validate(draft);

  return (
    <div className="stackf">
      {!canWrite ? (
        <Notice tone="warn">
          Solo un superadmin puede guardar cambios en el registro. Podés mirar la
          configuración, no modificarla.
        </Notice>
      ) : null}

      <Field label="Identificador" hint="Corto y estable. Se usa en el almacenamiento del navegador y en la caché.">
        <Input
          value={draft.slug}
          placeholder="ve-terremoto-2026"
          onChange={(e) => set("slug", e.target.value.trim())}
        />
      </Field>

      <Field
        label="Dominio"
        optional
        hint="El host por el que se sirve esta emergencia. Vacío mientras se prepara: sin dominio no la resuelve nadie."
      >
        <Input
          value={draft.host ?? ""}
          placeholder="ve.helpmaps.net"
          onChange={(e) => set("host", e.target.value.trim() || null)}
        />
      </Field>

      <Field label="Nombre del evento" hint="Lo que distingue dos emergencias del mismo país.">
        <Input
          value={draft.name}
          placeholder="Terremoto de Venezuela 2026"
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>

      <div className="frow2">
        <Field label="País" hint="El nombre que aparece en la marca y los metadatos.">
          <Input
            value={draft.country_name}
            placeholder="Venezuela"
            onChange={(e) => set("country_name", e.target.value)}
          />
        </Field>
        <Field label="Código ISO">
          <Input
            value={draft.country_code}
            placeholder="VE"
            maxLength={2}
            onChange={(e) => set("country_code", e.target.value.toUpperCase())}
          />
        </Field>
      </div>

      <div className="frow2">
        <Field label="Tipo de emergencia">
          <Select value={draft.hazard_type} onChange={(e) => set("hazard_type", e.target.value)}>
            {HAZARDS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Estado"
          hint="Borrador no lo sirve ningún dominio. Archivada se sigue consultando, no se sigue editando."
        >
          <Select
            value={draft.status}
            onChange={(e) => set("status", e.target.value as EmergencyRow["status"])}
          >
            <option value="draft">borrador</option>
            <option value="active">activa</option>
            <option value="archived">archivada</option>
          </Select>
        </Field>
      </div>

      <Field
        label="Aviso en el mapa"
        optional
        hint="Se muestra sobre el mapa de esta emergencia. Cuando el equipo baja los datos para reverificarlos, el mapa queda vacío a propósito y sin aviso se lee como que no hay nadie."
      >
        <Input
          value={draft.notice ?? ""}
          onChange={(e) => set("notice", e.target.value || null)}
        />
      </Field>

      <label className="fcheck">
        <input
          type="checkbox"
          checked={draft.maintenance}
          onChange={(e) => set("maintenance", e.target.checked)}
        />
        <span>Modo mantenimiento</span>
      </label>

      <JsonField
        label="Regiones"
        hint="[{ code, name, lat, lng, zoom? }] — los códigos son los que guarda cada punto."
        value={draft.regions}
        onChange={(v) => set("regions", (v ?? []) as EmergencyDraft["regions"])}
        rows={8}
      />

      <JsonField
        label="Encuadre del mapa"
        hint="center, zoom, regionZoom, bounds y geocodeCountry."
        value={draft.geo}
        onChange={(v) => set("geo", v as EmergencyDraft["geo"])}
        rows={7}
      />

      <JsonField
        label="Marco legal"
        hint="controller es la organización que responde por estos datos, y privacyEmail la dirección a la que escribe quien quiere que lo saquen."
        value={draft.legal}
        onChange={(v) => set("legal", v as EmergencyDraft["legal"])}
        rows={6}
      />

      <button type="button" className="linkish" onClick={() => setShowAdvanced((v) => !v)}>
        {showAdvanced ? "Ocultar" : "Mostrar"} lo que este país hace distinto
      </button>

      {showAdvanced ? (
        <>
          <Notice tone="info">
            Lo que se deja vacío sigue al kit compartido de la red, y lo sigue cuando la base
            mejore. Solo hace falta declarar lo que este país hace distinto.
          </Notice>
          <JsonField
            label="Sustantivo de región"
            value={draft.region_noun}
            onChange={(v) => set("region_noun", v as EmergencyDraft["region_noun"])}
            rows={4}
          />
          <JsonField
            label="Marca"
            hint="Solo lo que difiere: colors, logo, contact…"
            value={draft.brand}
            onChange={(v) => set("brand", (v ?? {}) as EmergencyDraft["brand"])}
          />
          <JsonField
            label="Módulos"
            hint="Un módulo se enciende cuando ya existe el dato que lo sustenta, no antes."
            value={draft.features}
            onChange={(v) => set("features", (v ?? {}) as EmergencyDraft["features"])}
          />
          <JsonField
            label="Idioma"
            hint="default, available y overrides por clave."
            value={draft.language}
            onChange={(v) => set("language", (v ?? {}) as EmergencyDraft["language"])}
          />
          <JsonField
            label="Capas sísmicas"
            hint="Se hereda de la red lo que no se declare."
            value={draft.hazard}
            onChange={(v) => set("hazard", (v ?? {}) as EmergencyDraft["hazard"])}
          />
          <JsonField
            label="Capas propias"
            hint="[{ id, label, kind, url, attribution, defaultOn }]"
            value={draft.layers}
            onChange={(v) => set("layers", (v ?? []) as EmergencyDraft["layers"])}
          />
          <JsonField
            label="Boletín de prensa"
            hint="feeds, keywords (emergency y place) y refreshHours. Sin medios declarados no hay boletín."
            value={draft.news}
            onChange={(v) => set("news", (v ?? {}) as EmergencyDraft["news"])}
            rows={8}
          />
        </>
      ) : null}

      {problems.length > 0 ? (
        <Notice tone="warn">
          {problems.length === 1 ? "Falta: " : "Faltan: "}
          {problems.join(" · ")}
        </Notice>
      ) : null}

      <div className="aacts">
        <Button onClick={onSave} disabled={busy || problems.length > 0 || !canWrite}>
          Guardar
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/**
 * What has to be filled in before this row can be saved at all.
 *
 * Deliberately thinner than `src/config/validate.ts`: that one runs on the assembled
 * configuration and decides whether a country can be SERVED. This one only asks whether a
 * draft can be STORED, so a superadmin can save a half-configured emergency and come back
 * to it — which is what `draft` status is for.
 */
function validate(d: EmergencyDraft): string[] {
  const out: string[] = [];
  if (!d.slug.trim()) out.push("identificador");
  if (!d.name.trim()) out.push("nombre del evento");
  if (!d.country_name.trim()) out.push("país");
  if (d.country_code.trim().length !== 2) out.push("código ISO de dos letras");
  if (!Array.isArray(d.geo?.center) || d.geo.center.length !== 2) out.push("centro del mapa");
  if (d.status === "active" && !d.legal?.controller?.trim()) {
    out.push("responsable de los datos (obligatorio para activarla)");
  }
  return out;
}
