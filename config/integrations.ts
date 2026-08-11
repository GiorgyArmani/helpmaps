// ── CON QUÉ HABLA ESTE DESPLIEGUE ───────────────────────────────────────────
//
// Las credenciales NO van aquí: viven en variables de entorno (ver `.env.example`).
// Este archivo decide qué se enciende, no con qué llave.
//
// ⚠️ ESTADO REAL, para que nadie encienda algo esperando que ocurra: hoy están conectados
// `pwa.enabled` (alimenta el manifiesto) y `email.to` (buzón al que llegan los avisos de
// sugerencias y voluntariado, ver `src/lib/email.ts`; sin SMTP en el entorno el módulo no
// hace nada y el equipo los ve igual en el panel). `analytics` y `feeds` están declarados
// porque son lo siguiente en la lista, pero ningún código los lee todavía.

import type { IntegrationsConfig } from "@/config/types";
import brand from "~/config/brand";

const integrations: IntegrationsConfig = {
  analytics: {
    // Vercel Web Analytics: sin cookies y sin PII. Compatible con la regla de no
    // registrar quién busca a quién, siempre que no se envíen eventos propios con
    // nombres, documentos ni términos de búsqueda. No lo hagas.
    vercel: false,
  },

  email: {
    // Vacío → los formularios solo guardan en la base y el equipo los ve en el panel.
    // Con correo configurado (SMTP_* en el entorno) además llega un aviso.
    to: brand.contact.email,
    from: brand.contact.email,
  },

  /**
   * Fuentes externas de puntos. El caso de referencia es AcopioVE (acopiove.org):
   * datos abiertos CC BY 4.0, así que la atribución es obligación de licencia y se
   * muestra en cada ficha que venga de ahí.
   *
   * ⚠️ El sincronizador todavía no está implementado en esta base (ver README).
   * Declarar una fuente aquí hoy solo afecta a la atribución que se muestra.
   */
  feeds: [],

  pwa: { enabled: true },
};

export default integrations;
