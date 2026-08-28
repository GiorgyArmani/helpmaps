"use client";

import Link from "next/link";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";

/**
 * La barra de la escena 3D.
 *
 * Es un componente de CLIENTE por una sola razón: el idioma. `app/3d/page.tsx` se
 * renderiza en el servidor, y el idioma que está leyendo la persona vive en el navegador
 * —lo eligió en el selector y quedó guardado— así que desde el servidor no hay forma de
 * saberlo. Con el enlace escrito allá, "Volver al mapa" salía en español con el resto de
 * la escena en inglés.
 *
 * El título llega como propiedad y NO se traduce cuando lo hay: es el rótulo que la
 * emergencia le puso a su conjunto de edificios, un dato suyo, no una palabra de la
 * interfaz.
 *
 * `null` significa que no hay conjunto de edificios y la escena es la del país con sus
 * puntos. Ahí el título SÍ es una palabra de la interfaz, y se traduce como cualquier
 * otra: poner el nombre de la emergencia sería repetir lo que ya dice la pestaña.
 */
export default function SceneBar({ title }: { title: string | null }) {
  const { t } = useI18n();

  return (
    <header className="scene3d-bar">
      <Link href="/" className="scene3d-back">
        <Icon.back />
        <span>{t("scene3d.back")}</span>
      </Link>
      <span className="scene3d-title">{title ?? t("scene3d.pointsTitle")}</span>
    </header>
  );
}
