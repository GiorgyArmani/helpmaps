"use client";

import type { ReactNode } from "react";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";

/**
 * Una lengüeta del canto que se despliega en panel.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * Esta forma estaba escrita TRES veces —capas del mapa, noticias y capas de la escena
 * 3D— con las mismas clases, la misma estructura y el mismo gesto, evolucionando por
 * separado. No es una deuda teórica: se tradujo el panel de capas al inglés y el de la
 * escena 3D siguió en español, porque son dos componentes distintos que se parecen. Un
 * arreglo en uno no llegaba al otro, y nada avisaba.
 *
 * Lo que sí cambia entre los tres es el ANCHO y el aire del panel: el de capas es una
 * lista de interruptores y el de noticias es texto para leer. Eso viaja como clase, no
 * como copia del componente.
 *
 * ── LA LENGÜETA LLEVA SU PALABRA ────────────────────────────────────────────
 *
 * Cerrada dice qué guarda, que es lo que un botón de icono no hace: un icono de capas
 * sobre un mapa no distingue "capas del mapa" de "cambiar el mapa base", y quien no lo
 * abre nunca se entera de que hay una capa encendida. Por eso `active` pinta la lengüeta
 * cerrada: el estado tiene que verse sin abrir nada.
 */
export default function SideTab({
  label,
  title,
  open,
  onOpenChange,
  active = false,
  className,
  panelClassName,
  headClassName,
  children,
}: {
  /** El rótulo vertical de la lengüeta cerrada. Corto: es una columna de 26px. */
  label: string;
  /** El encabezado del panel abierto, y el nombre accesible en los dos estados. */
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hay algo encendido detrás: se pinta la lengüeta cerrada. */
  active?: boolean;
  /** El envoltorio posicionado: `layersctl`, `newsctl`, `layersctl scene3d-layers`. */
  className: string;
  panelClassName: string;
  headClassName: string;
  children: ReactNode;
}) {
  const { t } = useI18n();

  if (!open) {
    return (
      <div className={className}>
        <button
          type="button"
          className={`sidetab${active ? " sidetab-on" : ""}`}
          aria-expanded={false}
          aria-label={title}
          title={title}
          onClick={() => onOpenChange(true)}
        >
          <Icon.chevron className="sidetab-ch" />
          <span className="sidetab-txt">{label}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Cierra al tocar fuera. Es un botón y no un div para que también cierre con el
          teclado, y sin fondo visible: oscurecer el mapa detrás de un panel que se abre
          para MIRAR el mapa es trabajar en contra. */}
      <button
        type="button"
        className="side-backdrop"
        aria-label={t("common.close")}
        onClick={() => onOpenChange(false)}
      />
      <div className={panelClassName} role="group" aria-label={title}>
        <div className={headClassName}>
          <b>{title}</b>
          <button
            type="button"
            className="layers-x"
            aria-label={t("common.close")}
            onClick={() => onOpenChange(false)}
          >
            <Icon.close />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
