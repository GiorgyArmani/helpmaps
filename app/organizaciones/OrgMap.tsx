"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
// Sólo tipos: el plugin aumenta el módulo "leaflet" y se carga en el efecto (`MapCanvas`).
import type {} from "leaflet.markercluster";
import type { LatLngBoundsExpression, Map as LeafletMap, Marker, MarkerClusterGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { LocationType } from "@/domain/types";
import { COUNTRY, MAPCFG, pinTypes, typeStyle } from "@/config";
import { clusterPinHtml, glyphSvg } from "@/features/map/pinGlyphs";
import { Icon } from "@/ui/icons";

/** Un lugar del directorio con su sitio: lo que hace falta para ponerlo en el mapa. */
export interface OrgMapEntry {
  id: string;
  name: string;
  desc: string;
  type: LocationType;
  lat: number;
  lng: number;
}


/**
 * El mapa de verdad en `/organizaciones`: el mismo que se ve en la app —sus teselas, sus
 * pines (`.mk`) y sus grupos (`clusterPinHtml`)—, para que la ONG vea dónde va a estar, y
 * no un dibujo que lo sugiere.
 *
 * Se queda en el país entero. Al buscar, se queda sólo con lo encontrado, lo encuadra y
 * lo rotula; al borrar la búsqueda, vuelve al país. Tocar un pin abre una tarjeta con «Es mi
 * organización», la misma acción que la lista de resultados.
 *
 * En el teléfono, un dedo sigue moviendo la PÁGINA (el mapa no se arrastra) y con dos se
 * acerca: un mapa que atrapa el desplazamiento en medio de una portada es una trampa.
 */
export default function OrgMap({
  entries,
  hits,
  label,
  mine,
  close,
}: {
  entries: OrgMapEntry[];
  /** Los ids encontrados, o null si no se está buscando. */
  hits: string[] | null;
  label: string;
  mine: string;
  close: string;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const groupsRef = useRef<Record<string, MarkerClusterGroup> | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const [ready, setReady] = useState(false);
  // Sube cada vez que se rehacen los marcadores: lo que se ve se vuelve a pintar con ellos.
  const [built, setBuilt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  // ── El mapa, una vez ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      if (cancelled || !box.current || mapRef.current) return;

      const mobile = L.Browser.mobile;
      map = L.map(box.current, {
        zoomControl: !mobile,
        scrollWheelZoom: false,
        dragging: !mobile,
        touchZoom: true,
        attributionControl: true,
        zoomSnap: 0.25,
      });
      // Ya en su encuadre al abrir, también con la columna del texto encima en escritorio.
      const inset = parseFloat(getComputedStyle(box.current.parentElement!).getPropertyValue("--map-inset")) || 0;
      const left = Math.round(map.getSize().x * inset);
      map.fitBounds(COUNTRY.geo.bounds as LatLngBoundsExpression, {
        paddingTopLeft: [left + 24, 24],
        paddingBottomRight: [24, 24],
      });
      map.zoomControl?.setPosition("bottomright");
      map.attributionControl.setPrefix("");
      L.tileLayer(MAPCFG.tiles.url, {
        attribution: MAPCFG.tiles.attribution,
        subdomains: MAPCFG.tiles.subdomains ?? "abc",
        maxZoom: MAPCFG.tiles.maxZoom,
      }).addTo(map);

      // Un grupo por tipo, como en la app: así los grupos se abren en abanico por tipo.
      const groups: Record<string, MarkerClusterGroup> = {};
      for (const type of pinTypes()) {
        groups[type] = L.markerClusterGroup({
          chunkedLoading: true,
          maxClusterRadius: 55,
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          disableClusteringAtZoom: MAPCFG.cluster.enabled ? MAPCFG.cluster.maxZoom : 0,
          iconCreateFunction: (cluster) =>
            L.divIcon({ className: "mkwrap", html: clusterPinHtml(type, cluster.getChildCount()), iconSize: [0, 0] }),
        }).addTo(map);
      }

      groupsRef.current = groups;
      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      groupsRef.current = null;
      markers.current = new Map();
    };
  }, []);

  // ── Los marcadores, cada vez que cambia la lista ───────────────────────
  // Aparte del mapa: cambiar de idioma vuelve a pintar la página en el servidor y trae una
  // lista nueva (las descripciones van traducidas). Antes eso desmontaba el mapa entero y
  // lo rehacía, y los puntos no volvían: el mapa nuevo llegaba tarde a su pintado.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void import("leaflet").then(({ default: L }) => {
      if (!alive) return;
      for (const g of Object.values(groupsRef.current ?? {})) g.clearLayers();
      const next = new Map<string, Marker>();
      for (const e of entries) {
        const marker = L.marker([e.lat, e.lng], {
          icon: L.divIcon(pinIcon(e.type, false)),
          title: e.name,
          alt: e.name,
          riseOnHover: true,
        });
        marker.on("click", () => setSelected(e.id));
        next.set(e.id, marker);
      }
      markers.current = next;
      setBuilt((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [ready, entries]);

  // ── Lo que se ve: el país entero, o sólo lo encontrado ─────────────────
  const hitsKey = hits ? hits.join(",") : null;
  useEffect(() => {
    const map = mapRef.current;
    const groups = groupsRef.current;
    if (!built || !map || !groups) return;
    let cancelled = false;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ids = hitsKey === null ? null : hitsKey ? hitsKey.split(",") : [];
    // En escritorio el texto tapa la izquierda del mapa (`--map-inset`, orgs.css): se
    // encuadra en lo que queda a la vista.
    const inset = parseFloat(getComputedStyle(box.current!.parentElement!).getPropertyValue("--map-inset")) || 0;
    const left = Math.round(map.getSize().x * inset);
    const pad = (p: number) => ({ paddingTopLeft: [left + p, p] as [number, number], paddingBottomRight: [p, p] as [number, number] });
    const shown = ids ? ids.filter((id) => markers.current.has(id)) : [...markers.current.keys()];

    for (const m of markers.current.values()) m.unbindTooltip();
    for (const g of Object.values(groups)) g.clearLayers();
    const pending: Record<string, Marker[]> = {};
    for (const id of shown) (pending[byId.get(id)!.type] ??= []).push(markers.current.get(id)!);
    for (const [type, batch] of Object.entries(pending)) groups[type]?.addLayers(batch);

    // El nombre en texto, nunca en HTML: viene de lo que escribió cada organización.
    const tag = (id: string) => {
      const el = document.createElement("span");
      el.textContent = byId.get(id)!.name;
      markers.current.get(id)?.bindTooltip(el, { permanent: true, direction: "right", className: "mklabel", offset: [8, 0] });
    };

    if (ids) {
      // Lo encontrado, encuadrado y con su nombre: los que caben sin pisarse.
      if (shown.length > 0) {
        const found = shown.map((id) => byId.get(id)!);
        const pts = found.map((e) => [e.lat, e.lng] as [number, number]);
        map.flyToBounds(pts, { ...pad(56), maxZoom: 15, animate: !still, duration: 1.2 });
        map.once("moveend", () => !cancelled && spread(map, found, 4, left).forEach(tag));
      }
    } else {
      // Sin buscar: el país entero, como abre. Sin vuelo: el mapa es el fondo, no un número.
      map.flyToBounds(COUNTRY.geo.bounds as LatLngBoundsExpression, { ...pad(24), animate: !still, duration: 1 });
    }
    return () => {
      cancelled = true;
    };
  }, [built, hitsKey, byId]);

  // ── El pin tocado, en el color de la selección ─────────────────────────
  useEffect(() => {
    if (!built || !selected) return;
    const m = markers.current.get(selected);
    const e = byId.get(selected);
    if (!m || !e) return;
    let alive = true;
    void import("leaflet").then(({ default: L }) => alive && m.setIcon(L.divIcon(pinIcon(e.type, true))));
    return () => {
      alive = false;
      void import("leaflet").then(({ default: L }) => m.setIcon(L.divIcon(pinIcon(e.type, false))));
    };
  }, [built, selected, byId]);

  const card = selected ? byId.get(selected) : undefined;

  return (
    <div className="olp-rmap">
      <div ref={box} className="olp-rmap-map" role="region" aria-label={label} />
      {!built ? <div className="olp-rmap-skel skel" aria-hidden="true" /> : null}
      {card ? (
        <div className="olp-rcard">
          <div className="olp-rcard-txt">
            <b>{card.name}</b>
            <span>{card.desc}</span>
          </div>
          <Link className="olp-rcard-go" href={`/c/${encodeURIComponent(card.id)}?gestionar=1`} prefetch={false}>
            {mine}
            <Icon.chevron width={16} height={16} />
          </Link>
          <button type="button" className="olp-rcard-x" aria-label={close} onClick={() => setSelected(null)}>
            <Icon.close width={16} height={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** El pin de la app (`MapCanvas`): la pastilla blanca con el glifo del tipo. */
function pinIcon(type: LocationType, on: boolean) {
  const style = typeStyle(type);
  return {
    className: "mkwrap",
    html:
      `<span class="mk${on ? " mk-on" : ""}">` +
      `<span class="mkico" style="color:${on ? "#fff" : style.color}">${glyphSvg(style.icon, 12)}</span>` +
      `</span>`,
    iconSize: [0, 0] as [number, number],
  };
}

/**
 * Lo encontrado que se rotula, ya en pantalla: dentro del cuadro, separados en altura para que los
 * nombres no se pisen y sin repetir nombre (una red con varias sedes se llama igual).
 */
function spread(map: LeafletMap, near: OrgMapEntry[], n: number, left = 0): string[] {
  const size = map.getSize();
  const picked: { id: string; name: string; y: number }[] = [];
  for (const e of near) {
    if (picked.length >= n) break;
    const p = map.latLngToContainerPoint([e.lat, e.lng]);
    // Lejos de los bordes, y a la izquierda del todo no: el nombre sale hacia la derecha.
    if (p.x < left + 24 || p.x > size.x - 120 || p.y < 72 || p.y > size.y - 96) continue;
    if (picked.some((q) => q.name === e.name || Math.abs(q.y - p.y) < 60)) continue;
    picked.push({ id: e.id, name: e.name, y: p.y });
  }
  return picked.map((q) => q.id);
}
