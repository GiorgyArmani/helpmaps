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

// Se lee una vez y se recorta: un salto de línea pegado al final de la variable
// en un .env se convertiría en una URL de tesela inválida y en un mapa en blanco.
const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();

const map: MapConfig = {
  // Teselas en ESCALA DE GRISES (CARTO Positron sobre datos de OpenStreetMap). No es
  // una preferencia estética: en este mapa el color pertenece a los puntos, y un mapa
  // base a todo color compite con los pines justo cuando alguien los está buscando.
  // La atribución es obligatoria por licencia: no la quites (validate.ts la exige).
  //
  // AHORA LLEVA API KEY. CARTO empezó a estampar una marca de agua "API key
  // required" sobre las teselas RASTER como éstas. La key va como parámetro
  // `key` en la URL y se lee de NEXT_PUBLIC_CARTO_API_KEY.
  //
  // Si la variable no está, la URL se queda TAL CUAL estaba y el mapa sigue
  // funcionando —con marca de agua—, que es lo que tiene que pasar en un clon
  // recién bajado: un despliegue sin key muestra un mapa feo, no un mapa roto.
  // Por eso el parámetro se omite entero en vez de mandarse vacío.
  //
  // La key es PÚBLICA por necesidad: viaja en la URL de cada tesela que pide el
  // navegador, así que cualquiera puede leerla con las herramientas de
  // desarrollo. Eso es inherente al servicio, no un descuido — lo que la
  // protege es la cuota (5.000.000 de teselas al mes) y que no sirve para nada
  // más. No la reutilices en proyectos ajenos a HelpMaps.
  //
  // Las teselas VECTORIALES todavía no piden key. Cuando la pidan, esta misma
  // variable ya está puesta.
  tiles: {
    url:
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" +
      (CARTO_API_KEY ? `?key=${CARTO_API_KEY}` : ""),
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
    // Iniciativa SIN sede: real, pero no es un sitio al que ir. No sale en los chips ni
    // en el abanico de clústeres (ver `pinTypes()`); vive en la pestaña "Digitales" y se
    // dibuja como aro de cobertura en el centroide de cada región que atiende. Cian, que
    // no se confunde con el azul de la iniciativa ciudadana ni con el teal del comedor.
    digital: { enabled: true, color: "#0891b2", icon: "globe", order: 5 },
    hospital: { enabled: true, color: "#dc2626", icon: "hospital", order: 6 },
    // Un pin de morgue no puede convertirse en un conteo de víctimas que alguien
    // captura de pantalla. Apagado salvo decisión explícita del equipo local.
    morgue: { enabled: false, color: "#475569", icon: "morgue", order: 7 },
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
