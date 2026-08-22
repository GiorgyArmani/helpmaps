// ── CÓMO HABLA ESTE DESPLIEGUE ──────────────────────────────────────────────
//
// El diccionario base vive en `src/i18n/dictionaries/`. Este archivo no lo reemplaza:
// lo PISA por clave, y por una razón práctica — cuando este clon traiga cambios del
// repo base, un diccionario editado a mano sería un conflicto en cada merge, mientras
// que un puñado de overrides aquí sobrevive intacto.
//
// Úsalo para vocabulario local: en Colombia un "refugio" puede ser un "albergue"; en
// otro país "punto de acopio" es "centro de acopio". Cambiar la palabra que la gente
// realmente usa vale más que cualquier rediseño.

import type { LanguageConfig } from "@/config/types";
import country from "~/config/country";
import { mergeLanguage } from "@/config/assemble";

const base: LanguageConfig = {
  default: "es",
  available: ["es", "en"],

  overrides: {
    es: {
      // Ejemplo real de localización (déjalo o quítalo según el país):
      // "type.shelter": "Albergue",
      // "type.shelter.plural": "Albergues",
    },
    en: {},
  },
};

// Lo de arriba es el vocabulario de la RED; lo que un país dice distinto vive en su
// preset (`config/presets/<pais>.ts` → `language`) y se funde aquí.
//
// La fusión es por idioma Y por clave, no por idioma entero: un país que renombra
// "refugio" a "albergue" conserva el resto de overrides que trae la base, y los sigue
// heredando cuando la base añada más.
/** El vocabulario de la RED, antes de los overrides del país. Lo usa la ruta de base de datos. */
export const BASE_LANGUAGE = base;

// La fusión vive en `@/config/assemble` porque la ruta de base de datos necesita la misma
// contra un país que no es el compilado. Una segunda copia se separaría de esta.
const language: LanguageConfig = mergeLanguage(base, country.language ?? {});

export default language;
