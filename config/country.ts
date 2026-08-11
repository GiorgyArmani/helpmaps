// ── DÓNDE ESTÁ ESTE DESPLIEGUE ──────────────────────────────────────────────
//
// Al clonar HelpMaps para un país nuevo hay dos caminos:
//
//   1. Ya existe el preset: pon NEXT_PUBLIC_COUNTRY=co (o "ve") en el entorno. Nada
//      que editar aquí.
//   2. No existe: copia `config/presets/_template.ts`, complétalo, impórtalo abajo y
//      ponlo como DEFAULT_COUNTRY.
//
// Todo lo geográfico, legal y de identidad del país vive en el preset. La marca, el
// idioma, las funciones activas y las integraciones son archivos aparte en `config/`.

import type { CountryConfig } from "@/config/types";
import colombia from "~/config/presets/colombia";
import venezuela from "~/config/presets/venezuela";

/** Presets incluidos en esta clonación. Borra los que no uses. */
const PRESETS: Record<string, CountryConfig> = {
  co: colombia,
  ve: venezuela,
};

/** Se usa cuando NEXT_PUBLIC_COUNTRY está VACÍO. Pon el TUYO. */
const DEFAULT_COUNTRY: CountryConfig = colombia;

// Referenciado literalmente para que Next lo inyecte en el bundle del cliente.
const selected = process.env.NEXT_PUBLIC_COUNTRY;

// Vacío → el país por defecto, que es el modo documentado de una clonación de un solo
// país y también el del hub. Con valor → tiene que existir.
//
// Un valor que no coincide REVIENTA aquí, en vez de caer al país por defecto. Antes caía:
// desplegar con NEXT_PUBLIC_COUNTRY="pe" servía Colombia entera —regiones, encuadre,
// aviso legal— bajo el dominio de Perú, y nada en la interfaz lo delataba. Un fallo de
// despliegue tiene que doler en el build, no descubrirse cuando alguien mire el mapa.
if (selected && !PRESETS[selected]) {
  throw new Error(
    `NEXT_PUBLIC_COUNTRY="${selected}" no existe en config/country.ts. ` +
      `Presets disponibles: ${Object.keys(PRESETS).join(", ")}. ` +
      `Para un país nuevo: copia config/presets/_template.ts, complétalo y añádelo a PRESETS. ` +
      `Déjala vacía para usar el país por defecto (${DEFAULT_COUNTRY.slug}).`,
  );
}

const country: CountryConfig = (selected && PRESETS[selected]) || DEFAULT_COUNTRY;

/** Todos los presets disponibles — el hub los usa para listar la red. */
export const AVAILABLE_PRESETS = PRESETS;

export default country;
