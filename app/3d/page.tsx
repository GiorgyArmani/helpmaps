import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { currentEmergency, getSite } from "@/server/emergency";
import { buildingLayers } from "@/domain/layers";
import { Icon } from "@/ui/icons";

const Scene3D = dynamic(() => import("@/features/map3d/Scene3D"));

export const metadata: Metadata = {
  title: "Daños en 3D",
  // La escena es una lectura de un modelo, no un censo de edificios: no tiene por qué
  // aparecer en un buscador separada del mapa que le da contexto.
  robots: { index: false, follow: false },
};

/**
 * The 3D scene, for emergencies that declare a buildings dataset.
 *
 * A deployment with no such dataset has no route here at all — a 404 rather than an empty
 * scene, because an empty 3D view of a disaster zone reads as "nothing was damaged".
 */
export default async function Scene3DPage({
  searchParams,
}: {
  searchParams: Promise<{ l?: string }>;
}) {
  const [emergency, site, params] = await Promise.all([
    currentEmergency(),
    getSite(),
    searchParams,
  ]);

  // La escena existe si hay un conjunto de edificios que mostrar. Sin él sería un mapa
  // 3D vacío de una zona de desastre, que se lee como "no pasó nada".
  const declared = emergency?.layers ?? [];
  const scenes = buildingLayers(declared);
  if (scenes.length === 0) notFound();

  // `?l=` sigue eligiendo el conjunto que encuadra la escena; el resto de las capas de la
  // emergencia viajan igual, apagadas o encendidas según lo que cada una declare.
  const focus = (params.l ? scenes.find((s) => s.id === params.l) : null) ?? scenes[0]!;
  const ordered = [focus, ...declared.filter((l) => l.id !== focus.id)];

  return (
    <main className="scene3d-page">
      <header className="scene3d-bar">
        <Link href="/" className="scene3d-back">
          <Icon.back />
          <span>Volver al mapa</span>
        </Link>
        <span className="scene3d-title">{focus.label}</span>
      </header>
      <Scene3D layers={ordered} fallbackCenter={site.country.geo.center} />
    </main>
  );
}
