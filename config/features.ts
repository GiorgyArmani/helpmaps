// ── QUÉ OFRECE ESTE DESPLIEGUE ──────────────────────────────────────────────
//
// Regla: una función se enciende cuando ya existe el dato que la sustenta, no antes.
// Una lista vacía de personas en un mapa no se lee como "todavía no tenemos datos", se
// lee como "aquí no pasó nada" — y eso es peor que no ofrecerla.
//
// Esto es lo que ofrece la RED por defecto. Un país que quiera apagar o encender algo lo
// dice en su preset (`config/presets/<pais>.ts` → `features`), y se funde encima.

import type { FeatureConfig } from "@/config/types";
import country from "~/config/country";
import { mergeFeatures } from "@/config/assemble";

const base: FeatureConfig = {
  // Núcleo cívico — lo que un país puede llenar desde el primer día.
  needs: true,
  suggestions: true,
  volunteerSignup: true,
  // Con la lista vacía sigue teniendo sentido: lo que muestra entonces es la invitación
  // a que una organización pida aparecer, y esa invitación es el primer paso.
  donations: true,
  // La portada del QR impreso (/inicio). Se muestra UNA vez por navegador: quien vuelve
  // entra directo al mapa. Apágala si este despliegue reparte solo el enlace del mapa.
  entryPage: true,
  publicApi: true,
  offline: true,

  // Requieren una red médica alimentando datos verificados. Además, los módulos
  // correspondientes todavía NO están portados desde HelpMap Venezuela: encenderlos hoy
  // no muestra nada. Ver README → "Migrar Venezuela".
  //
  // Los tres van en `false` porque ningún código los lee todavía. `missingReports` estuvo
  // en `true` durante un tiempo sin que eso encendiera nada — un interruptor muerto y
  // encendido es peor que uno apagado: el día que se cablee el módulo, aparece solo en
  // todos los despliegues que heredaron el valor, sin que nadie lo decida.
  // La validación de `src/config/validate.ts` avisa si alguno vuelve a `true` antes de
  // tiempo.
  patients: false,
  rescued: false,
  missingReports: false,
};

/** El valor de la RED, antes de los overrides del país. Lo usa la ruta de base de datos. */
export const BASE_FEATURES = base;

const features: FeatureConfig = mergeFeatures(base, country.features);

export default features;
