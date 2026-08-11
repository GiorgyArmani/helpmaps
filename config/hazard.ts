// ── LA EMERGENCIA QUE ESTE DESPLIEGUE ESTÁ CUBRIENDO ────────────────────────
//
// Las capas sísmicas se leen EN VIVO del servicio de USGS (earthquake.usgs.gov). No hay
// que copiar datos a mano ni mantener un GeoJSON en el repo: cuando USGS revisa la
// magnitud o vuelve a calcular el ShakeMap, el mapa cambia solo en la siguiente carga.
//
// Dos capas, y la diferencia es la que importa en campo:
//
//   epicentros      DÓNDE se rompió. Un punto por sismo.
//   zona afectada   DÓNDE SACUDIÓ. Los contornos de intensidad (MMI) que publica el
//                   propio USGS. Un sismo de 110 km de profundidad como el del Chocó no
//                   sacude un círculo alrededor del epicentro: sacude una mancha alargada
//                   que puede dejar un departamento entero fuera y meter otro que está al
//                   doble de distancia. Esa mancha es la que decide dónde hacen falta
//                   refugios, y por eso se dibuja tal cual la publica USGS en vez de
//                   aproximarla con un radio.
//
// AMBAS SON ESTIMACIONES y USGS las revisa. El ShakeMap automático sale en minutos y se
// corrige después. La UI lo dice en cada capa; no le quites ese aviso: un contorno es
// intensidad modelada, nunca un censo de casas caídas.
//
// Para apagar todo esto en un país sin sismos: `enabled: false`. Desaparece la capa, el
// botón y la leyenda.

import type { HazardConfig } from "@/config/types";

const hazard: HazardConfig = {
  seismic: {
    enabled: true,

    // Servicio FDSN público de USGS. Sin API key, sin cuota publicada y con CORS
    // abierto, así que el navegador lo consulta directo — sin proxy propio, que además
    // sería un punto de caída más justo durante una emergencia.
    api: "https://earthquake.usgs.gov/fdsnws/event/1/query",

    // Obligatoria por la política de créditos de USGS. No la quites.
    attribution: "Datos sísmicos: USGS Earthquake Hazards Program",

    // Por debajo de M4.5 la lista se llena de réplicas que no cambian ninguna decisión
    // a escala de país. Sube a 5 si el enjambre satura el mapa.
    minMagnitude: 4.5,

    // Dos semanas: cubre el evento principal y su secuencia de réplicas, que es el
    // periodo en el que un refugio se abre, se llena o se cierra.
    windowDays: 14,

    maxEvents: 60,

    // Durante una crisis activa USGS revisa magnitudes y alertas en horas, no en días.
    refreshMinutes: 15,

    // `null` = los límites del país (config/presets/*.ts → geo.bounds). Lo normal: el
    // sismo que importa aquí es el que se sintió aquí.
    bounds: null,

    // Cada ShakeMap cuesta dos peticiones extra y ~100 KB. Por debajo de M6 la huella no
    // se distingue a zoom de país y no vale ese gasto en una conexión de emergencia.
    contourMinMagnitude: 6,

    // La zona afectada arranca encendida: es la pregunta con la que llega la gente
    // ("¿me tocó a mí?"). Los epicentros se prenden aparte porque son contexto sísmico,
    // no una capa de ayuda.
    defaultOn: { epicenters: false, intensity: true },
  },
};

export default hazard;
