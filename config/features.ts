// ── QUÉ OFRECE ESTE DESPLIEGUE ──────────────────────────────────────────────
//
// Regla: una función se enciende cuando ya existe el dato que la sustenta, no antes.
// Una lista vacía de personas en un mapa no se lee como "todavía no tenemos datos", se
// lee como "aquí no pasó nada" — y eso es peor que no ofrecerla.

import type { FeatureConfig } from "@/config/types";

const features: FeatureConfig = {
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
  patients: false,
  rescued: false,
  missingReports: true,
};

export default features;
