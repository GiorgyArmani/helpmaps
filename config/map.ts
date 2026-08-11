// ── CÓMO SE LEE EL MAPA ─────────────────────────────────────────────────────
//
// Dos decisiones aquí no son cosméticas:
//
// 1. El color del pin es el TIPO de punto, nunca un estado. En la versión anterior el
//    pin tomaba el color del peor estado de las personas dentro, y un hospital se
//    pintaba gris "fallecido": el número al lado se leía como un conteo de muertos.
//    Los tipos se distinguen entre sí; el estado se muestra con texto, no con el pin.
//
// 2. `enabled: false` desaparece el tipo del mapa, de los chips y de los formularios.
//    Un país sin morgues publicadas no debería mostrar un filtro que siempre da cero.

import type { MapConfig } from "@/config/types";

const map: MapConfig = {
  // Teselas en ESCALA DE GRISES (CARTO Positron sobre datos de OpenStreetMap). No es
  // una preferencia estética: en este mapa el color pertenece a los puntos, y un mapa
  // base a todo color compite con los pines justo cuando alguien los está buscando.
  // Sin API key ni cuota. La atribución es obligatoria por licencia: no la quites.
  tiles: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap © CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  },

  types: {
    shelter: { enabled: true, color: "#d97706", icon: "shelter", order: 1 },
    donation_centre: { enabled: true, color: "#7c3aed", icon: "box", order: 2 },
    comedor: { enabled: true, color: "#0d9488", icon: "meal", order: 3 },
    // `users`, no "spark": una iniciativa ciudadana es gente organizada, no un edificio
    // ni una novedad destacada. La chispa se leía como "nuevo" y no como un lugar.
    iniciativa: { enabled: true, color: "#2563eb", icon: "users", order: 4 },
    hospital: { enabled: true, color: "#dc2626", icon: "hospital", order: 5 },
    // Un pin de morgue no puede convertirse en un conteo de víctimas que alguien
    // captura de pantalla. Apagado salvo decisión explícita del equipo local.
    morgue: { enabled: false, color: "#475569", icon: "morgue", order: 6 },
  },

  cluster: {
    enabled: true,
    maxZoom: 13,
  },

  userLocation: true,

  // Pasados estos días sin confirmación, el punto se marca como posiblemente
  // desactualizado y se sugiere llamar antes de ir. Un "necesita agua" de hace tres
  // semanas es una suposición, no información.
  staleAfterDays: 10,
};

export default map;
