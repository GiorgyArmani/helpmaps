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

const language: LanguageConfig = {
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

export default language;
