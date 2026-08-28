import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { currentEmergency, currentEmergencyId, getSite } from "@/server/emergency";
import { supabasePublic } from "@/lib/supabase/server";
import { fetchCenters } from "@/data/centers";
import { buildingLayers } from "@/domain/layers";
import { typeStyle } from "@/config";
import SceneBar from "@/features/map3d/SceneBar";
import type { ScenePoint } from "@/features/map3d/Scene3D";
import type { LocationType } from "@/domain/types";

const Scene3D = dynamic(() => import("@/features/map3d/Scene3D"));

export const metadata: Metadata = {
  title: "Vista 3D",
  // La escena es una lectura del terreno y de un modelo, no un censo: no tiene por qué
  // aparecer en un buscador separada del mapa que le da contexto.
  robots: { index: false, follow: false },
};

/**
 * La escena 3D.
 *
 * ── QUÉ CAMBIÓ Y POR QUÉ ────────────────────────────────────────────────────
 *
 * Antes esta ruta exigía una capa `buildings3d` y devolvía 404 sin ella. El razonamiento
 * era bueno —una escena 3D vacía de una zona de desastre se lee como "aquí no pasó nada"—
 * pero ataba la existencia de la ruta a un dataset de daños que casi ningún despliegue
 * tiene. En la práctica el botón 3D sólo funcionaba con las capas de demostración puestas,
 * y al quitarlas la ruta moría.
 *
 * El argumento sigue en pie: la escena no puede estar vacía. Lo que cambia es qué la
 * llena. Los puntos del mapa sobre el relieve real ya dicen algo que el mapa plano no
 * puede decir — qué refugios están en ladera y cuáles en el valle, que en Venezuela es
 * media explicación de por dónde bajó el agua. Así que la escena existe cuando hay algo
 * que mostrar: puntos, edificios, o las dos cosas.
 *
 * Sin ninguna de las dos sigue siendo 404, por la razón de siempre.
 */
export default async function Scene3DPage({
  searchParams,
}: {
  searchParams: Promise<{ l?: string }>;
}) {
  const [emergency, site, params, emergencyId] = await Promise.all([
    currentEmergency(),
    getSite(),
    searchParams,
    currentEmergencyId(),
  ]);

  const declared = emergency?.layers ?? [];
  const scenes = buildingLayers(declared);

  // Los puntos se traen en el SERVIDOR y se reducen a cinco campos. El objeto `Center`
  // entero son 520 fichas completas —teléfonos, horarios, necesidades— cruzando el límite
  // servidor→cliente para dibujar 520 círculos que no muestran nada de eso.
  //
  // El color se resuelve también acá: `typeStyle` vive en la configuración, y hacer que la
  // escena lo importe sería una segunda copia de la paleta del mapa a la que olvidarse de
  // seguir.
  const sb = supabasePublic();
  let centers: ScenePoint[] = [];
  if (sb) {
    try {
      const rows = await fetchCenters(sb, emergencyId);
      centers = rows.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        lat: c.lat,
        lng: c.lng,
        color: typeStyle(c.type as LocationType).color,
      }));
    } catch {
      // Sin puntos la escena sigue teniendo sentido si hay edificios; el guardia de abajo
      // decide. Tumbar la ruta entera por una consulta caída sería peor.
    }
  }

  if (scenes.length === 0 && centers.length === 0) notFound();

  // `?l=` sigue eligiendo el conjunto de edificios que encuadra la escena. Sin edificios
  // no hay nada que elegir y la vista se abre sobre el país.
  const focus = (params.l ? scenes.find((s) => s.id === params.l) : null) ?? scenes[0] ?? null;
  const ordered = focus ? [focus, ...declared.filter((l) => l.id !== focus.id)] : declared;

  return (
    <main className="scene3d-page">
      <SceneBar title={focus?.label ?? null} />
      <Scene3D
        layers={ordered}
        centers={centers}
        // ⚠️ Invertido a propósito. `country.geo.center` viene en `[lat, lng]` porque
        //    lo consume el mapa 2D, que es Leaflet; MapLibre espera `[lng, lat]`. El
        //    error es mudo —no lanza, no avisa— y abre la escena en el océano Antártico.
        fallbackCenter={[site.country.geo.center[1], site.country.geo.center[0]]}
      />
    </main>
  );
}
