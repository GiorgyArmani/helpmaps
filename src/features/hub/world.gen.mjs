// Genera `world.ts`: el mundo en una rejilla de celdas, cada una con el código ISO de su
// país. Es lo que dibuja `HubWorld.tsx` en la portada del hub.
//
// Sólo hace falta volver a correrlo para cambiar la resolución o el encuadre; sumar un
// país a la red NO lo necesita (la rejilla ya trae todos los países).
//
//   1. Bajar Natural Earth 1:110m (dominio público), países en GeoJSON:
//      https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
//   2. node src/features/hub/world.gen.mjs <ese archivo> src/features/hub/world.ts
import { readFileSync, writeFileSync } from "node:fs";

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error("uso: node world.gen.mjs <countries.geojson> <world.ts>");

// Sin la Antártida ni el Ártico: no hay red allí y se comerían un tercio del alto.
const WEST = -168;
const EAST = 180;
const NORTH = 72;
const SOUTH = -56;
// La celda: más baja que ancha en grados, cuadrada en pantalla. Estirar el mundo a lo
// alto le da al trópico —donde está la red— más filas de las que tendría.
const D_LNG = 2.4;
const D_LAT = 1.8;
const cols = Math.round((EAST - WEST) / D_LNG);
const rows = Math.round((NORTH - SOUTH) / D_LAT);

const feats = JSON.parse(readFileSync(src, "utf8")).features.map((f) => {
  const p = f.properties;
  // Natural Earth deja `ISO_A2` en "-99" para Francia y Noruega; `ISO_A2_EH` lo trae bien.
  const code = [p.ISO_A2_EH, p.ISO_A2].find((c) => /^[A-Z]{2}$/.test(c)) ?? "??";
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const xs = polys.flatMap((poly) => poly[0].map(([x]) => x));
  const ys = polys.flatMap((poly) => poly[0].map(([, y]) => y));
  return { code, polys, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
});

function inRing(x, y, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function countryAt(x, y) {
  for (const f of feats) {
    const [x0, y0, x1, y1] = f.box;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    for (const poly of f.polys) {
      if (inRing(x, y, poly[0]) && !poly.slice(1).some((hole) => inRing(x, y, hole))) return f.code;
    }
  }
  return null;
}

// Cinco muestras por celda (el centro y los cuatro cuartos): es tierra con dos o más, y
// del país que más muestras tenga. Con sólo el centro, las costas y las islas salían
// mordidas.
const SAMPLES = [
  [0.5, 0.5],
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
];

const grid = [];
let land = 0;
for (let r = 0; r < rows; r++) {
  let line = "";
  for (let c = 0; c < cols; c++) {
    const tally = new Map();
    for (const [fx, fy] of SAMPLES) {
      const code = countryAt(WEST + (c + fx) * D_LNG, NORTH - (r + fy) * D_LAT);
      if (code) tally.set(code, (tally.get(code) ?? 0) + 1);
    }
    const total = [...tally.values()].reduce((a, b) => a + b, 0);
    if (total < 2) {
      line += "  ";
      continue;
    }
    line += [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    land++;
  }
  grid.push(line);
}

writeFileSync(
  out,
  `// GENERADO por \`world.gen.mjs\` — no editar a mano.
//
// El mundo en una rejilla de ${cols} × ${rows} celdas (${D_LNG}° × ${D_LAT}°), de ${WEST}° a ${EAST}° de longitud y
// de ${NORTH}° a ${SOUTH}° de latitud. Cada celda son DOS caracteres: el código ISO del país que la
// ocupa, o dos espacios si es mar. Sale de Natural Earth 1:110m (dominio público).
//
// Lleva el país de cada celda —y no sólo «tierra / mar»— para que el mapa del hub
// encienda un país con sólo estar en \`config/network.ts\`: sumar un despliegue sigue
// siendo editar la configuración, no volver a generar este archivo.

export const WORLD = {
  west: ${WEST},
  north: ${NORTH},
  dLng: ${D_LNG},
  dLat: ${D_LAT},
  cols: ${cols},
  rows: ${rows},
  grid: [
${grid.map((l) => `    ${JSON.stringify(l)},`).join("\n")}
  ],
} as const;
`,
);
console.log(`${cols} × ${rows} celdas, ${land} de tierra → ${out}`);
