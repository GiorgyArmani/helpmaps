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

/** Se usa cuando NEXT_PUBLIC_COUNTRY está vacío o no coincide. Pon el TUYO. */
const DEFAULT_COUNTRY: CountryConfig = colombia;

// Referenciado literalmente para que Next lo inyecte en el bundle del cliente.
const selected = process.env.NEXT_PUBLIC_COUNTRY;

const country: CountryConfig = (selected && PRESETS[selected]) || DEFAULT_COUNTRY;

/** Todos los presets disponibles — el hub los usa para listar la red. */
export const AVAILABLE_PRESETS = PRESETS;

export default country;
