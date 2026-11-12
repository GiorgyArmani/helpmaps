import type { CSSProperties } from "react";
import { NETWORK } from "@/config";
import { WORLD } from "./world";

/**
 * La red, dibujada en ASCII: el mundo en caracteres y, encendidos, los países donde
 * HelpMaps está desplegado. Es el mismo lenguaje que el país de la portada de `/inicio`
 * (`AsciiMap`), llevado a la escala de la red, y se comporta igual: primero se imprime
 * el mundo, fila a fila, y después el dibujo se acerca a donde HelpMaps YA funciona.
 *
 * ── POR QUÉ NO ES UN MAPA DE TESELAS ────────────────────────────────────────
 *
 * Antes aquí había un Leaflet con un pin por país. Para enseñar cinco puntos descargaba
 * la librería, su hoja de estilos y las teselas del mundo entero, y a esa escala los pines
 * de Colombia, Venezuela y Perú caían uno encima del otro: no se podía tocar el que se
 * quería. Esto lo pinta el servidor, llega con el HTML y no pide nada más.
 *
 * Es un DIBUJO, no un control: quien quiere abrir un país lo hace en la lista de debajo,
 * donde cada uno tiene su fila entera para tocar.
 *
 * ── SALE DE LA CONFIGURACIÓN ────────────────────────────────────────────────
 *
 * `world.ts` guarda de qué país es cada celda, así que un país se enciende con sólo estar
 * en `config/network.ts`, y el zoom va a donde estén los que están en línea: nada aquí
 * sabe que hoy son Colombia y Venezuela. Tres capas por fila —tierra, en preparación, en
 * línea— para que cada una lleve su color sin un `<tspan>` por carácter. Los huecos son
 * espacios de no separación: uno normal lo colapsa el SVG y descuadra la fila.
 */

/** El lado de una celda, en unidades del dibujo. */
const CELL = 10;
const BLANK = "\u00a0";
/** Cuántas celdas de contexto quedan alrededor de lo que está en línea, tras el zoom. */
const MARGIN = 7;
/** La proporción del cuadro en escritorio (`.hub-world-box`): decide cuánto cabe a lo alto. */
const FRAME = 5 / 4;

/**
 * Todo lo que el dibujo necesita, calculado de la rejilla y de la red: las filas, los pines
 * y a dónde va el zoom.
 */
function drawWorld() {
  const { cols, rows, grid, west, north, dLng, dLat } = WORLD;
  const status = new Map(NETWORK.map((d) => [d.code, d.status]));
  const width = cols * CELL;

  // Donde ya funciona, un pin: la celda en la que cae cada despliegue en línea. El pin
  // OCUPA esa celda —es un carácter más del mapa—, así que ahí no se dibuja tierra.
  const pins = NETWORK.filter((d) => d.status === "live").map((d) => ({
    slug: d.slug,
    c: Math.min(cols - 1, Math.max(0, Math.floor((d.lng - west) / dLng))),
    r: Math.min(rows - 1, Math.max(0, Math.floor((north - d.lat) / dLat))),
  }));
  const pinned = new Set(pins.map((p) => p.r * cols + p.c));

  // El recuadro de lo que está en línea, en celdas: hasta ahí llega el zoom.
  let c0: number = cols;
  let c1 = -1;
  let r0: number = rows;
  let r1 = -1;

  const lines = grid.map((line, r) => {
    let land = "";
    let soon = "";
    let live = "";
    for (let c = 0; c < cols; c++) {
      const code = line.slice(c * 2, c * 2 + 2);
      const pin = pinned.has(r * cols + c);
      const s = code === "  " ? undefined : status.get(code);
      land += code !== "  " && !s && !pin ? "#" : BLANK;
      soon += s === "preparing" && !pin ? "+" : BLANK;
      live += s === "live" && !pin ? "#" : BLANK;
      if (s === "live" || pin) {
        c0 = Math.min(c0, c);
        c1 = Math.max(c1, c);
        r0 = Math.min(r0, r);
        r1 = Math.max(r1, r);
      }
    }
    return { y: (r + 0.5) * CELL, land, soon, live };
  });

  // El zoom: el centro de ese recuadro va al centro del cuadro, y se acerca hasta que el
  // recuadro más su margen lo llena. Entre 1 y 5 aumentos: con la red repartida por medio
  // mundo no hay a dónde acercarse y se queda el mundo entero; con un solo país pequeño,
  // más de 5 dejaría cuatro caracteres gigantes. Sin nada en línea, tampoco se mueve.
  const any = c1 >= 0;
  const fits = Math.min(
    cols / (c1 - c0 + 1 + 2 * MARGIN),
    cols / FRAME / (r1 - r0 + 1 + 2 * MARGIN),
  );
  const zoom = {
    ["--fx" as string]: any ? `${(((c0 + c1 + 1) / 2 / cols) * 100).toFixed(2)}%` : "50%",
    ["--fy" as string]: any ? `${(((r0 + r1 + 1) / 2 / rows) * 100).toFixed(2)}%` : "50%",
    ["--zs" as string]: any ? Math.min(5, Math.max(1, fits)).toFixed(2) : "1",
  } as CSSProperties;

  return { width, rows, lines, pins, zoom };
}

export default function HubWorld({ label }: { label: string }) {
  const { width, rows, lines, pins, zoom } = drawWorld();

  const row = (cls: string, y: number, text: string) =>
    text.trim() ? (
      <text className={cls} x={0} y={y} textLength={width} lengthAdjust="spacing">
        {text}
      </text>
    ) : null;

  return (
    <div className="hub-world-box" style={zoom}>
      <svg
        className="hub-world"
        viewBox={`0 0 ${width} ${rows * CELL}`}
        role="img"
        aria-label={label}
        preserveAspectRatio="xMidYMid meet"
      >
        {lines.map((l, r) => (
          <g key={r} className="hub-world-row" style={{ ["--r" as string]: r } as CSSProperties}>
            {row("hub-world-land", l.y, l.land)}
            {row("hub-world-soon", l.y, l.soon)}
            {row("hub-world-live", l.y, l.live)}
          </g>
        ))}
        {/* Los pines: laten con su onda, desfasados para que no latan a la vez, y
            aparecen cuando el zoom ya llegó. El carácter arranca donde arranca su celda,
            como los de la fila; la onda, en el centro de la letra. */}
        {pins.map((p, i) => (
          <g key={p.slug} className="hub-world-pin" style={{ ["--k" as string]: i } as CSSProperties}>
            <circle
              className="hub-world-ping"
              cx={(p.c + 0.36) * CELL}
              cy={(p.r + 0.5) * CELL}
              r={CELL * 0.8}
            />
            <text className="hub-world-at" x={p.c * CELL} y={(p.r + 0.5) * CELL}>
              @
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
