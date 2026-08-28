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
import country from "~/config/country";

// Los valores de la RED. Lo que un país lee distinto vive en su preset
// (`config/presets/<pais>.ts` → `hazard`) y se funde abajo: estos números están afinados
// para un margen de subducción —Colombia, Perú, Indonesia— y no valen igual en todas
// partes. España es el caso que lo demuestra: su secuencia de Granada no pasa de M5.2, y
// con `contourMinMagnitude: 6` la capa de zona afectada saldría VACÍA en el despliegue
// que existe justamente para cubrir ese sismo.
const base: HazardConfig = {
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

    // `null` = cae a los límites del país (config/presets/*.ts → geo.bounds).
    //
    // ⚠️ Es un valor por defecto aproximado, no el correcto, y conviene saber en qué falla
    // antes de dejarlo puesto. `geo.bounds` existe para encuadrar el mapa y sesgar el
    // geocodificador, y las dos cosas quieren un rectángulo generoso — que se vea mar
    // alrededor, que buscar cerca del borde no falle. Generoso, en un rectángulo,
    // significa el país del vecino dentro.
    //
    // Medido en Venezuela: de 52 sismos devueltos por USGS en 180 días, 21 eran de
    // Colombia y uno de Trinidad. El 42% de los puntos del mapa eran de otro país.
    //
    // No se puede arreglar solo. Derivar la caja de los centroides de `regions` se probó
    // y se midió: mejora Venezuela y rompe Perú e Indonesia, porque recorta la fosa —los
    // centroides costeros están tierra adentro y los sismos grandes están mar afuera.
    // Una caja sacada de la FORMA de un país no describe su sismicidad.
    //
    // Así que si tu país tiene un vecino sísmicamente activo pegado a la frontera, o una
    // fosa mar adentro, declara acá TU cinturón —no tu silueta—. El ejemplo trabajado, con
    // las mediciones al lado, está en `config/presets/venezuela.ts`.
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

// Fusión de un nivel dentro de `seismic`: un país declara los dos números que lee
// distinto y sigue heredando el resto —la API, la atribución, el refresco— cuando la
// base los cambie.
const hazard: HazardConfig = {
  seismic: { ...base.seismic, ...(country.hazard?.seismic ?? {}) },
};

export default hazard;
