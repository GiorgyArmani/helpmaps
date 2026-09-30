"use client";

import type { ReactNode } from "react";
import { Icon } from "@/ui/icons";

/**
 * Elegir varios de una lista corta, a toques. Lo usan los oficios y la disponibilidad de la
 * cuenta y el «qué le falta» de un evento.
 *
 * Botones con `aria-pressed` y no casillas: cada opción es un blanco de 44 px que se
 * acierta con el pulgar, y un lector de pantalla los anuncia como «activado / desactivado».
 * El elegido lleva además la marca de verificación —no sólo el color— para quien no
 * distingue el acento del fondo.
 */
export default function ToggleChips<T extends string>({
  options,
  value,
  onChange,
  label,
  renderLabel,
  icon,
}: {
  options: readonly T[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  /** El nombre del grupo, para quien no lo ve. */
  label: string;
  renderLabel: (option: T) => string;
  icon?: (option: T) => ReactNode;
}) {
  const on = new Set(value);

  function toggle(option: T) {
    // Se conserva el orden del catálogo y no el del toque: así dos personas con los mismos
    // oficios los leen igual, y la lista guardada no depende de en qué orden se marcaron.
    onChange(options.filter((o) => (o === option ? !on.has(o) : on.has(o))));
  }

  return (
    <div className="tchips" role="group" aria-label={label}>
      {options.map((o) => {
        const pressed = on.has(o);
        return (
          <button
            key={o}
            type="button"
            className={`tchip${pressed ? " tchip-on" : ""}`}
            aria-pressed={pressed}
            onClick={() => toggle(o)}
          >
            {pressed ? <Icon.check /> : icon ? icon(o) : null}
            {renderLabel(o)}
          </button>
        );
      })}
    </div>
  );
}
