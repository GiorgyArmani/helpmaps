"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { BRAND, NETWORK, MAPCFG } from "@/config";

/**
 * The network map on helpmaps.net: one pin per country where HelpMaps is deployed.
 * Tapping a live pin opens that country's app.
 *
 * A "preparing" deployment is drawn hollow and is NOT clickable — announcing a country
 * is fine, sending someone to a URL that does not answer yet is not.
 */
export default function HubMap() {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;

      const points = NETWORK.map((d) => [d.lat, d.lng] as [number, number]);
      map = L.map(ref.current, { zoomControl: false, scrollWheelZoom: false });
      L.tileLayer(MAPCFG.tiles.url, {
        attribution: MAPCFG.tiles.attribution,
        maxZoom: MAPCFG.tiles.maxZoom,
      }).addTo(map);

      for (const d of NETWORK) {
        const live = d.status === "live";
        const marker = L.marker([d.lat, d.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="${live ? "hub-pin" : "hub-pin-soon"}"><span>${d.flag}</span></div>`,
            iconSize: [0, 0],
          }),
          title: d.name,
          alt: d.name,
        }).addTo(map);
        if (live) marker.on("click", () => window.open(d.url, "_blank", "noopener"));
      }

      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points).pad(0.6));
      } else if (points[0]) {
        map.setView(points[0], 5);
      } else {
        map.setView([4, -70], 3);
      }

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={ref} className="hub-map" role="application" aria-label={BRAND.platform} />;
}
