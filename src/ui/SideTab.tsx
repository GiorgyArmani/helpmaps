"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { useDismiss } from "@/ui/useDismiss";

/**
 * Un control del mapa que se despliega en panel: Capas, Noticias y las capas de la escena 3D.
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
 * ── LLEVA SU PALABRA, Y AHORA SE PUEDE LEER ─────────────────────────────────
 *
 * Cerrado dice qué guarda, que es lo que un botón de sólo icono no hace: un icono de capas
 * sobre un mapa no distingue "capas del mapa" de "cambiar el mapa base", y quien no lo abre
 * nunca se entera de que hay una capa encendida. Por eso `active` pinta el botón cerrado:
 * el estado tiene que verse sin abrir nada.
 *
 * Era una lengüeta vertical pegada al canto: 27px de ancho y el rótulo girado, a 10px y en
 * mayúsculas. La palabra estaba, pero había que torcer la cabeza para leerla y el pulgar
 * tenía que acertar una franja más estrecha que la yema. Ahora es un botón de 44px de alto
 * con icono y palabra en horizontal, separado del borde como los demás controles del mapa.
 */
export default function SideTab({
  label,
  title,
  icon,
  open,
  onOpenChange,
  active = false,
  className,
  panelClassName,
  headClassName,
  children,
}: {
  /** El rótulo del botón cerrado. Corto: una o dos palabras. */
  label: string;
  /** El encabezado del panel abierto. */
  title: string;
  /** El icono que acompaña a la palabra en el botón cerrado. */
  icon?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hay algo encendido detrás: se pinta el botón cerrado. */
  active?: boolean;
  /** El envoltorio posicionado: `layersctl`, `newsctl`, `layersctl scene3d-layers`. */
  className: string;
  panelClassName: string;
  headClassName: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  // Se cierra al tocar fuera, con Escape o con atrás, y abrir otro control o un menú de la
  // barra lo cierra: Capas y Noticias abiertas a la vez se tapaban una a otra.
  useDismiss(open, close, ref);

  if (!open) {
    return (
      <div className={className} ref={ref}>
        {/* Sin `aria-label`: el nombre accesible es la palabra que se VE. Con el título largo
            como etiqueta, quien dicta «pulsa Noticias» no encontraba ningún botón con ese
            nombre, porque se llamaba «Qué se está reportando». */}
        <button
          type="button"
          className={`maptab${active ? " maptab-on" : ""}`}
          aria-expanded={false}
          title={title}
          onClick={() => onOpenChange(true)}
        >
          {icon ? (
            <span className="maptab-ic" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <span className="maptab-txt">{label}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={className} ref={ref}>
      {/* Sin fondo que oscurezca: oscurecer el mapa detrás de un panel que se abre para
          MIRAR el mapa es trabajar en contra. El cierre al tocar fuera lo pone `useDismiss`. */}
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
