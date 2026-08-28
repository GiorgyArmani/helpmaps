// ── QUÉ ES ESTE DESPLIEGUE ──────────────────────────────────────────────────
//
// El mismo código sirve dos cosas distintas:
//
//   "country"  una app nacional (co.helpmaps.net): el mapa, los centros, las
//              necesidades, el panel del equipo. Es el modo por defecto.
//
//   "hub"      helpmaps.net: qué es HelpMaps, en qué países está desplegado (mapa
//              clicable), la documentación de la API pública, los términos y cómo
//              traerlo a tu país.
//
// Se elige con NEXT_PUBLIC_MODE=hub en el proyecto del dominio raíz. Un clon de país no
// toca nada aquí.

import type { DeploymentMode } from "@/config/types";

const raw = process.env.NEXT_PUBLIC_MODE;

const mode: DeploymentMode = raw === "hub" ? "hub" : "country";

export default mode;
