"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LocationType } from "@/domain/types";
import { makeCenterId, type CenterDraft } from "@/data/centers";
import { Button, Field, Input, Notice } from "@/ui/primitives";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";
import { useSiteHelpers } from "@/features/app/SiteProvider";
import { geocode, matchRegion, type GeoResult } from "@/features/admin/geocode";
import PinPreview from "@/features/admin/PinPreview";

// Por debajo de este ancho el panel es una hoja que tapa el mapa (ver `.sheet` en
// `globals.css`): ahí el pin necesita su propio mapa dentro del panel.
const NARROW = "(max-width: 767px)";
function subscribeNarrow(cb: () => void): () => void {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Lo que trae un registro de `/organizaciones` (ver `orgHints` en `AdminPanel`). */
export interface OrgRegistration {
  name: string;
  type: LocationType;
  region?: string;
  address?: string;
  contact: string | null;
}

/**
 * Aprobar una organización que se registró sola en `/organizaciones`.
 *
 * ── EL EQUIPO SÓLO APRUEBA ──────────────────────────────────────────────────
 *
 * Una iniciativa nueva tiene que poder sumarse sin que nadie del equipo le rellene la
 * ficha: descripción, horario, qué necesita, cómo contactarla y sus fotos los pone ella
 * en su bienvenida (`/?mine=1`), que es para lo que existe. Por eso esto NO es el
 * formulario del punto: es un resumen y un botón.
 *
 * ── LO ÚNICO QUE SÍ ES DEL EQUIPO: EL PIN ──────────────────────────────────
 *
 * Un gestor no puede mover su punto (`locations` sólo la escribe el equipo, ver
 * `db/01_esquema.sql`), y un pin mal puesto manda a la gente al lugar equivocado. Así que
 * al abrir se busca solo con la dirección que escribió la organización y el pin aparece
 * en el mapa, arrastrable. El caso normal es mirar y aprobar; si no se encuentra, se pega
 * un enlace de Maps, que siempre resuelve.
 */
export default function OrgApprove({
  org,
  onApprove,
  onCancel,
  pinDragRef,
  onCoordsChange,
}: {
  org: OrgRegistration;
  onApprove: (draft: CenterDraft) => Promise<void>;
  onCancel: () => void;
  pinDragRef: React.MutableRefObject<((at: { lat: number; lng: number }) => void) | null>;
  onCoordsChange: (at: { lat: number; lng: number } | null) => void;
}) {
  const { t } = useI18n();
  const helpers = useSiteHelpers();
  const regionName = org.region ? helpers.regionLabel(org.region) : "";

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [region, setRegion] = useState(org.region ?? "");
  const [municipality, setMunicipality] = useState("");
  const [query, setQuery] = useState(org.address ?? "");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );

  const pick = useCallback((r: GeoResult) => {
    setPin({ lat: r.lat, lng: r.lng });
    setMunicipality((m) => m || r.municipality || "");
    setRegion((g) => g || matchRegion(r.state) || "");
    setResults([]);
    setNotFound(false);
  }, []);

  const search = useCallback(
    async (q: string) => {
      const text = q.trim() || org.name;
      setSearching(true);
      setNotFound(false);
      setResults([]);
      try {
        const hits = await geocode(text, { regionName: regionName || undefined });
        if (hits.length === 0) setNotFound(true);
        // Uno solo se aplica directo; con varios, el primero va al mapa y los demás quedan
        // a mano por si el primero no era.
        else {
          pick(hits[0]!);
          if (hits.length > 1) setResults(hits);
        }
      } catch {
        setNotFound(true);
      } finally {
        setSearching(false);
      }
    },
    [org.name, regionName, pick],
  );

  // Al abrir, se busca solo: es lo que hace que aprobar sea un toque.
  const searched = useRef(false);
  useEffect(() => {
    if (searched.current) return;
    searched.current = true;
    void search(org.address ?? "");
  }, [search, org.address]);

  // El pin al mapa, y el arrastre del mapa de vuelta aquí (mismo cableado que `CenterForm`).
  useEffect(() => {
    onCoordsChange(pin);
  }, [pin, onCoordsChange]);
  useEffect(() => {
    pinDragRef.current = (at) => setPin({ lat: at.lat, lng: at.lng });
    return () => {
      pinDragRef.current = null;
      onCoordsChange(null);
    };
  }, [pinDragRef, onCoordsChange]);

  async function approve() {
    if (!pin || saving) return;
    setSaving(true);
    setError(null);
    // Sólo lo que hace falta para que exista en el mapa. La ficha queda vacía a
    // propósito: la llena la organización en su bienvenida. Ni las notas ni el nombre de
    // quien escribió se publican — eran para el equipo.
    const draft: CenterDraft = {
      id: makeCenterId(org.name, org.type),
      name: org.name,
      type: org.type,
      region: region || null,
      municipality: municipality.trim() || null,
      lat: pin.lat,
      lng: pin.lng,
      address: org.address?.trim() || null,
      phone: null,
      whatsapp: null,
      active: true,
      coverage_regions: [],
      coverage_municipalities: [],
      info: {
        status: null,
        receives: [],
        offers: [],
        needs: null,
        help: [],
        category: null,
        description: null,
        schedule: null,
        hours: null,
        contact_name: null,
        social_url: null,
        website: null,
        instagram: null,
        is_animal: false,
      },
    };
    try {
      await onApprove(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.saveError"));
      setSaving(false);
    }
  }

  const place = [org.address, regionName].filter(Boolean).join(" · ");

  return (
    <div className="form">
      <div className="drows">
        <div className="drow">
          <span className="dlabel">{t("form.type")}</span>
          <span className="dval">{t(`type.${org.type}` as DictKey)}</span>
        </div>
        {place ? (
          <div className="drow">
            <span className="dlabel">{t("admin.org.where")}</span>
            <span className="dval">{place}</span>
          </div>
        ) : null}
        {org.contact ? (
          <div className="drow">
            <span className="dlabel">{t("admin.org.contact")}</span>
            <span className="dval">{org.contact}</span>
          </div>
        ) : null}
      </div>

      <fieldset className="fieldset">
        <legend className="legend">{t("admin.org.pinTitle")}</legend>
        {/* Mientras busca, el hueco del resultado ya está: nada salta al llegar. */}
        {searching ? (
          <div className="skel" style={{ height: 44 }} aria-hidden="true" />
        ) : pin ? (
          <p className="small" role="status">
            <Icon.check width={16} height={16} aria-hidden="true" /> {t("admin.org.pinFound")}
          </p>
        ) : null}
        {pin && narrow && !searching ? (
          <PinPreview at={pin} onMove={setPin} label={t("admin.org.pinMap")} />
        ) : null}
        {notFound ? <p className="geo-empty">{t("admin.org.pinNotFound")}</p> : null}
        {results.length > 1 ? (
          <div className="geo-results">
            {results.map((r) => (
              <button key={`${r.lat},${r.lng}`} type="button" className="geo-res" onClick={() => pick(r)}>
                <Icon.directions />
                {r.label}
              </button>
            ))}
          </div>
        ) : null}
        <Field label={t("form.findAddress")} hint={t("form.findAddressHint")}>
          <div className="geo-row">
            <Input
              value={query}
              placeholder={t("form.findAddressPlaceholder")}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (!searching) void search(query);
              }}
            />
            <Button variant="ghost" small onClick={() => void search(query)} loading={searching}>
              <Icon.search width={15} height={15} />
              {searching ? t("form.searching") : t("common.search")}
            </Button>
          </div>
        </Field>
      </fieldset>

      <p className="fhint">{t("admin.org.restByThem")}</p>
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="frow">
        <Button onClick={() => void approve()} loading={saving} disabled={!pin || searching}>
          {t("admin.org.approve")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
