/**
 * El dibujo del avatar, en SVG escrito a mano. Estilo: los vecinos de Animal Crossing en 2D.
 *
 * ── POR QUÉ CADENAS Y NO COMPONENTES ────────────────────────────────────────
 *
 * Un personaje son unas cuarenta figuras. Como cadenas se componen en un solo paso, se
 * cachean por avatar y pesan unos 4 KB por especie sin una sola foto ni petición. Todo lo
 * que entra en ellas sale de los catálogos de abajo (ids validados, colores de la paleta):
 * nunca texto de una persona, así que pintarlas con `dangerouslySetInnerHTML` es seguro.
 *
 * ── LOS COLORES DE AQUÍ SON ILUSTRACIÓN, NO INTERFAZ ────────────────────────
 *
 * La regla de «ningún color a mano» es para la interfaz, que sale de `config/brand.ts`.
 * Éstos son el pelaje de un chigüire y el rojo de una cayena: no cambian con la marca de un
 * país, igual que no cambia un logo.
 *
 * ── UN SOLO CUERPO ──────────────────────────────────────────────────────────
 *
 * Todas las especies comparten el cuerpo (120 x 150) y sólo cambia la cabeza. Por eso la
 * ropa y los accesorios se ajustan una vez y le quedan a todas; lo único por especie es
 * dónde tiene los ojos (para los lentes) y cuánto se sube el sombrero.
 */
import type { Avatar, ColorId, HabitatId, Piece, SpeciesId } from "@/domain/avatar";
import { itemDef } from "@/domain/avatar";

export type Mood = "neutral" | "feliz" | "sorpresa";

interface Paint {
  c: string;
  s: string;
}
const PAL: Record<ColorId, Paint> = {
  rojo: { c: "#e5233b", s: "#a8162a" },
  amarillo: { c: "#f6c026", s: "#b98a0e" },
  azul: { c: "#2a6fdb", s: "#1b4fa3" },
  verde: { c: "#2f9e5b", s: "#1f6e3f" },
  morado: { c: "#7b5cd6", s: "#5638a8" },
  rosado: { c: "#ef7aa6", s: "#c4527e" },
  negro: { c: "#2b2b2e", s: "#111113" },
  crema: { c: "#efe6d2", s: "#c9b98f" },
  marron: { c: "#7d5230", s: "#4e321c" },
};
export function paint(id: ColorId): string {
  return PAL[id].c;
}

const HAB: Record<HabitatId, { sky: string; g: string; d: string }> = {
  llanos: { sky: "#f6dfa0", g: "#a9c25d", d: "M0 98 Q60 90 120 98 L120 120 L0 120Z" },
  andes: { sky: "#d3def2", g: "#8798b8", d: "M0 92 L22 70 L40 86 L62 60 L84 84 L100 72 L120 90 L120 120 L0 120Z" },
  tepuy: { sky: "#c4e6d3", g: "#4f8a6a", d: "M0 98 L16 98 L22 72 L66 72 L72 98 L120 98 L120 120 L0 120Z" },
  caribe: { sky: "#bfe9f0", g: "#f0dfae", d: "M0 100 Q30 94 60 100 T120 100 L120 120 L0 120Z" },
  orinoco: { sky: "#f1d8bd", g: "#b98a5e", d: "M0 96 Q40 102 80 94 T120 98 L120 120 L0 120Z" },
  selva: {
    sky: "#cfe8b8",
    g: "#3f7a45",
    d: "M0 96 Q12 80 24 96 Q36 78 50 96 Q64 80 78 96 Q92 78 106 96 Q114 86 120 94 L120 120 L0 120Z",
  },
};
export function habitatSwatch(h: HabitatId): string {
  return HAB[h].g;
}

/* ── Kit de cara compartido ── */
const D = "#1b1416";
function eye(cx: number, cy: number, m: Mood, s = 1): string {
  if (m === "feliz")
    return `<path d="M${cx - 6 * s} ${cy + 2} Q${cx} ${cy - 6 * s} ${cx + 6 * s} ${cy + 2}" stroke="${D}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const w = `<ellipse cx="${cx}" cy="${cy}" rx="${6.6 * s}" ry="${7.6 * s}" fill="#fff"/>`;
  if (m === "sorpresa")
    return `${w}<circle cx="${cx}" cy="${cy + 0.5}" r="${3 * s}" fill="${D}"/><circle cx="${cx + s}" cy="${cy - 0.6 * s}" r="${s}" fill="#fff"/>`;
  return (
    `${w}<ellipse cx="${cx}" cy="${cy + 0.6}" rx="${5 * s}" ry="${6.2 * s}" fill="${D}"/>` +
    `<circle cx="${cx + 1.6 * s}" cy="${cy - 2.4 * s}" r="${1.9 * s}" fill="#fff"/><circle cx="${cx - 1.7 * s}" cy="${cy + 2.6 * s}" r="${0.9 * s}" fill="#fff"/>`
  );
}
const eyes = (y: number, dx: number, m: Mood, s?: number) => eye(60 - dx, y, m, s) + eye(60 + dx, y, m, s);
const blush = (y: number, dx: number) =>
  `<circle cx="${60 - dx}" cy="${y}" r="6.4" fill="#ff8fa3" opacity=".75"/><circle cx="${60 + dx}" cy="${y}" r="6.4" fill="#ff8fa3" opacity=".75"/>`;
function mouth(y: number, m: Mood, c = D): string {
  if (m === "feliz") return `<path d="M54.5 ${y} Q60 ${y + 8} 65.5 ${y}Z" fill="#7a2e2e"/>`;
  if (m === "sorpresa") return `<ellipse cx="60" cy="${y + 2}" rx="2.6" ry="3.2" fill="#7a2e2e"/>`;
  return `<path d="M54 ${y} Q57 ${y + 3} 60 ${y} Q63 ${y + 3} 66 ${y}" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
}

interface SpeciesArt {
  /** Manos y patas. */
  skin: string;
  /** Dónde tiene los ojos: [y, separación desde el centro]. Lo usan los lentes. */
  e: [number, number];
  /** Cuánto se mueve el sombrero (el caimán tiene los ojos encima de la cabeza). */
  hy?: number;
  tail?: "fluke" | "coil";
  head: (m: Mood) => string;
}

const SPECIES_ART: Record<SpeciesId, SpeciesArt> = {
  turpial: {
    skin: "#3a3a40",
    e: [48, 19],
    head: (m) =>
      '<path d="M50 24 Q52 8 60 16 Q66 6 70 22Z" fill="#1e1b1f"/><ellipse cx="60" cy="54" rx="42" ry="35" fill="#1e1b1f"/><ellipse cx="22" cy="66" rx="8" ry="12" fill="#f7a21b"/><ellipse cx="98" cy="66" rx="8" ry="12" fill="#f7a21b"/><circle cx="41" cy="48" r="13" fill="#3d7ff0"/><circle cx="79" cy="48" r="13" fill="#3d7ff0"/>' +
      eyes(48, 19, m) +
      '<path d="M50 62 Q60 56 70 62 Q66 74 60 78 Q54 74 50 62Z" fill="#c9ced4"/><path d="M52 64 Q60 60 68 64" stroke="#a3aab2" stroke-width="1.6" fill="none"/>' +
      (m === "feliz" ? '<path d="M55 70 Q60 74 65 70" stroke="#7a2e2e" stroke-width="2" fill="none"/>' : "") +
      blush(66, 30),
  },
  chiguire: {
    skin: "#9a6c47",
    e: [46, 20],
    head: (m) =>
      '<ellipse cx="33" cy="27" rx="8" ry="7" fill="#8a5f3c"/><ellipse cx="87" cy="27" rx="8" ry="7" fill="#8a5f3c"/><ellipse cx="33" cy="28" rx="4" ry="3.4" fill="#6e4a2e"/><ellipse cx="87" cy="28" rx="4" ry="3.4" fill="#6e4a2e"/><rect x="17" y="22" width="86" height="66" rx="33" fill="#b5845a"/><path d="M55 23 Q60 13 65 23Z" fill="#b5845a"/><rect x="35" y="52" width="50" height="34" rx="17" fill="#9a6c47"/><ellipse cx="52" cy="61" rx="3.4" ry="2.4" fill="#4a3222"/><ellipse cx="68" cy="61" rx="3.4" ry="2.4" fill="#4a3222"/>' +
      mouth(75, m, "#4a3222") +
      eyes(46, 20, m) +
      blush(62, 33),
  },
  caiman: {
    skin: "#8fa465",
    e: [33, 20],
    hy: -13,
    head: (m) =>
      '<circle cx="40" cy="33" r="14" fill="#9bb070"/><circle cx="80" cy="33" r="14" fill="#9bb070"/><ellipse cx="60" cy="54" rx="42" ry="28" fill="#9bb070"/><g fill="#6f8450"><circle cx="22" cy="54" r="3"/><circle cx="98" cy="54" r="3"/><circle cx="60" cy="34" r="3"/></g><rect x="28" y="52" width="64" height="34" rx="17" fill="#b4c78a"/><path d="M34 80 L37 86 L40 80Z M80 80 L83 86 L86 80Z" fill="#fff"/><circle cx="52" cy="59" r="2.4" fill="#4a5a2c"/><circle cx="68" cy="59" r="2.4" fill="#4a5a2c"/>' +
      mouth(76, m, "#4a5a2c") +
      eyes(33, 20, m, 0.92) +
      blush(64, 37),
  },
  frontino: {
    skin: "#232120",
    e: [48, 19],
    head: (m) =>
      '<circle cx="28" cy="26" r="13" fill="#232120"/><circle cx="92" cy="26" r="13" fill="#232120"/><circle cx="28" cy="27" r="6.5" fill="#3d3836"/><circle cx="92" cy="27" r="6.5" fill="#3d3836"/><ellipse cx="60" cy="55" rx="42" ry="34" fill="#232120"/><ellipse cx="41" cy="48" rx="13" ry="12" fill="#ead9b3"/><ellipse cx="79" cy="48" rx="13" ry="12" fill="#ead9b3"/><path d="M50 40 Q60 34 70 40 L66 52 L54 52Z" fill="#ead9b3"/><ellipse cx="60" cy="70" rx="17" ry="13" fill="#e2cfa6"/><ellipse cx="60" cy="63" rx="7" ry="4.6" fill="#141212"/>' +
      mouth(74, m, "#141212") +
      eyes(48, 19, m) +
      blush(64, 33),
  },
  tonina: {
    skin: "#ee9db1",
    e: [50, 18],
    tail: "fluke",
    head: (m) =>
      '<ellipse cx="60" cy="52" rx="40" ry="34" fill="#f3a9bb"/><ellipse cx="56" cy="30" rx="22" ry="9" fill="#fff" opacity=".22"/><ellipse cx="60" cy="76" rx="15" ry="11" fill="#f8c6d2"/><path d="M97 26 Q100 32 97 35 Q94 32 97 26Z" fill="#6cc3e0"/>' +
      mouth(78, m, "#b8586f") +
      eyes(50, 18, m) +
      blush(64, 30),
  },
  jaguar: {
    skin: "#efb544",
    e: [50, 19],
    head: (m) =>
      '<path d="M22 44 Q20 14 40 18 Q46 28 44 40Z" fill="#efb544"/><path d="M98 44 Q100 14 80 18 Q74 28 76 40Z" fill="#efb544"/><path d="M27 38 Q26 22 37 23 Q40 30 39 37Z" fill="#3b2a18"/><path d="M93 38 Q94 22 83 23 Q80 30 81 37Z" fill="#3b2a18"/><ellipse cx="60" cy="55" rx="43" ry="34" fill="#f2bd52"/><g fill="none" stroke="#3b2a18" stroke-width="2.4"><circle cx="60" cy="30" r="4"/><circle cx="47" cy="33" r="3"/><circle cx="73" cy="33" r="3"/><circle cx="24" cy="58" r="3.4"/><circle cx="96" cy="58" r="3.4"/><circle cx="30" cy="72" r="2.8"/><circle cx="90" cy="72" r="2.8"/></g><circle cx="60" cy="30" r="1.4" fill="#3b2a18"/><ellipse cx="60" cy="70" rx="18" ry="13" fill="#fbf1dc"/><path d="M54 62 Q60 59 66 62 L60 68Z" fill="#d9707a"/><path d="M60 68 L60 71" stroke="#3b2a18" stroke-width="1.8"/>' +
      mouth(73, m, "#3b2a18") +
      eyes(50, 19, m) +
      blush(64, 34),
  },
  palmero: {
    skin: "#8b7865",
    e: [44, 17],
    head: (m) =>
      '<circle cx="30" cy="30" r="8" fill="#7a6857"/><circle cx="90" cy="30" r="8" fill="#7a6857"/><path d="M50 22 Q55 10 60 19 Q65 10 70 22Z" fill="#7a6857"/><ellipse cx="60" cy="48" rx="38" ry="30" fill="#a8937e"/><path d="M28 60 Q60 74 92 60" stroke="#1f1a16" stroke-width="5" fill="none" opacity=".75" stroke-linecap="round"/><path d="M28 56 Q60 70 92 56" stroke="#efe7d8" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M50 54 Q50 92 60 98 Q70 92 70 54Z" fill="#94806b"/><ellipse cx="60" cy="96" rx="5" ry="3.6" fill="#1f1a16"/>' +
      (m === "feliz"
        ? '<path d="M60 100 Q64 106 59 110" stroke="#e0607a" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
        : "") +
      eyes(44, 17, m, 0.9) +
      blush(56, 30),
  },
  cardenalito: {
    skin: "#e0262f",
    e: [50, 19],
    head: (m) =>
      '<ellipse cx="60" cy="86" rx="28" ry="7" fill="#e0262f"/><path d="M52 24 Q56 8 66 20Z" fill="#1b1b1b"/><ellipse cx="60" cy="54" rx="41" ry="34" fill="#1b1b1b"/>' +
      eyes(50, 19, m) +
      '<path d="M52 63 Q60 58 68 63 L60 76Z" fill="#d8c3b0"/>' +
      (m === "feliz" ? '<path d="M56 70 Q60 73 64 70" stroke="#7a2e2e" stroke-width="2" fill="none"/>' : "") +
      blush(66, 31),
  },
  perroagua: {
    skin: "#5d3c28",
    e: [48, 19],
    head: (m) =>
      '<ellipse cx="60" cy="86" rx="18" ry="6" fill="#efe3c6"/><circle cx="24" cy="40" r="7" fill="#4e3222"/><circle cx="96" cy="40" r="7" fill="#4e3222"/><ellipse cx="60" cy="54" rx="41" ry="33" fill="#6b4630"/><ellipse cx="60" cy="68" rx="21" ry="13" fill="#8a6146"/><ellipse cx="60" cy="61" rx="7.5" ry="4.8" fill="#1b120c"/><path d="M40 68 L26 66 M40 72 L26 74 M80 68 L94 66 M80 72 L94 74" stroke="#efe3c6" stroke-width="1.4" stroke-linecap="round"/>' +
      mouth(72, m, "#1b120c") +
      eyes(48, 19, m) +
      blush(62, 33),
  },
  anaconda: {
    skin: "#6e8d36",
    e: [48, 19],
    tail: "coil",
    head: (m) =>
      '<ellipse cx="60" cy="54" rx="40" ry="32" fill="#86a646"/><g fill="#2b3113"><circle cx="60" cy="30" r="3.6"/><circle cx="46" cy="32" r="2.6"/><circle cx="74" cy="32" r="2.6"/><circle cx="24" cy="54" r="3"/><circle cx="96" cy="54" r="3"/></g><path d="M22 46 Q30 58 34 56 M98 46 Q90 58 86 56" stroke="#e08a2e" stroke-width="3.4" fill="none" stroke-linecap="round"/><ellipse cx="60" cy="68" rx="22" ry="13" fill="#9cba5c"/><circle cx="54" cy="62" r="1.8" fill="#2b3113"/><circle cx="66" cy="62" r="1.8" fill="#2b3113"/>' +
      (m === "feliz"
        ? '<path d="M60 80 L60 88 M60 88 L57 91 M60 88 L63 91" stroke="#d9364a" stroke-width="1.8" stroke-linecap="round" fill="none"/>'
        : mouth(73, m, "#2b3113")) +
      eyes(48, 19, m) +
      blush(62, 32),
  },
};

function seeds(): string {
  const cols = ["#8a4b2a", "#cf142b", "#2b2b2e"];
  let s = "";
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = (1 - t) * (1 - t) * 44 + 2 * (1 - t) * t * 60 + t * t * 76;
    const y = (1 - t) * (1 - t) * 88 + 2 * (1 - t) * t * 104 + t * t * 88;
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${cols[i % 3]}"/>`;
  }
  return s;
}

/** Ropa: el color de la tela y lo que lleva encima. */
const SHIRTS: Record<string, { base: (p: Paint) => string; d: (p: Paint) => string }> = {
  lisa: {
    base: (p) => p.c,
    d: (p) => `<path d="M54 87 Q60 92 66 87" stroke="${p.s}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  },
  rayas: {
    base: () => "#f7f7f5",
    d: (p) =>
      `<g fill="${p.c}"><rect x="40" y="96" width="40" height="5"/><rect x="40" y="106" width="40" height="5"/><rect x="40" y="116" width="40" height="5"/></g>`,
  },
  playera: {
    base: (p) => p.c,
    d: () =>
      '<g fill="#ffd23f"><circle cx="52" cy="99" r="2.6"/><circle cx="67" cy="107" r="2.6"/><circle cx="55" cy="117" r="2.6"/><circle cx="70" cy="95" r="2.2"/><circle cx="62" cy="121" r="2"/></g><path d="M53 87 L60 95 L67 87" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>',
  },
  chaqueta: {
    base: (p) => p.c,
    d: (p) =>
      `<path d="M60 88 L60 128" stroke="${p.s}" stroke-width="2"/><path d="M52 86 L60 96 L68 86" fill="#f7f7f5"/><rect x="45" y="108" width="9" height="6" rx="2" fill="${p.s}"/><rect x="66" y="108" width="9" height="6" rx="2" fill="${p.s}"/>`,
  },
  pelotero: {
    base: () => "#f7f7f5",
    d: () =>
      '<g stroke="#0b2a66" stroke-width="1.2" opacity=".45"><path d="M50 90 L48 126 M55 88 L54 127 M60 88 L60 128 M65 88 L66 127 M70 90 L72 126"/></g><path d="M53 87 L60 95 L67 87" stroke="#0b2a66" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M53 106 L56 114 L59 106 M62 114 L62 106 L66 106 M62 110 L65 110 M62 114 L66 114" stroke="#cf142b" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  vinotinto: {
    base: () => "#7a1f2b",
    d: () =>
      '<path d="M54 87 L60 93 L66 87" stroke="#f6c026" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="67" cy="100" r="3" fill="#f6c026"/>',
  },
  liqui: {
    base: () => "#f3eedf",
    d: () =>
      '<rect x="52" y="84" width="16" height="5" rx="2" fill="#e2d9bf"/><g fill="#b9a675"><circle cx="60" cy="94" r="1.6"/><circle cx="60" cy="102" r="1.6"/><circle cx="60" cy="110" r="1.6"/><circle cx="60" cy="118" r="1.6"/></g><path d="M47 100 L53 100 M67 100 L73 100" stroke="#d6cba9" stroke-width="2.4" stroke-linecap="round"/>',
  },
};

/** Accesorios. `a` es la especie: los lentes necesitan saber dónde están sus ojos. */
const PIECES: Record<string, (p: Paint, a: SpeciesArt) => string> = {
  gorra: (p) =>
    `<path d="M30 38 Q30 10 60 10 Q90 10 90 38Z" fill="${p.c}"/><path d="M60 36 Q88 31 102 39 Q88 44 60 40Z" fill="${p.s}"/><circle cx="60" cy="11" r="3" fill="${p.s}"/>`,
  gorro: (p) =>
    `<path d="M25 40 Q25 6 60 6 Q95 6 95 40Z" fill="${p.c}"/><rect x="23" y="34" width="74" height="11" rx="5.5" fill="${p.s}"/><circle cx="60" cy="6" r="7" fill="${p.s}"/>`,
  llanero: (p) =>
    `<ellipse cx="60" cy="27" rx="42" ry="8" fill="${p.s}"/><path d="M38 27 Q40 2 60 2 Q80 2 82 27Z" fill="${p.c}"/><rect x="39" y="19" width="42" height="5" fill="#2b1d12"/>`,
  boina: (p) =>
    `<ellipse cx="56" cy="27" rx="32" ry="11" fill="${p.c}"/><path d="M30 31 Q56 39 84 31" stroke="${p.s}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="54" cy="15" r="3" fill="${p.s}"/>`,
  panoleta: (p) =>
    `<path d="M26 40 Q60 2 94 40 Q60 26 26 40Z" fill="${p.c}"/><path d="M92 36 L106 28 L104 44Z" fill="${p.c}"/><g fill="#fff" opacity=".85"><circle cx="48" cy="25" r="1.6"/><circle cx="60" cy="19" r="1.6"/><circle cx="72" cy="25" r="1.6"/><circle cx="60" cy="30" r="1.6"/></g>`,
  cintillo: (p) => `<path d="M27 42 Q60 6 93 42" stroke="${p.c}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  cayena: (p) =>
    `<g transform="translate(88 30)">${[
      [0, -8],
      [7.6, -2.5],
      [4.7, 6.5],
      [-4.7, 6.5],
      [-7.6, -2.5],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${p.c}"/>`)
      .join("")}<circle cx="0" cy="0" r="3.4" fill="${p.c === PAL.amarillo.c ? "#b7791f" : "#ffd23f"}"/></g>`,
  tricolor: () =>
    '<path d="M27 46 Q60 10 93 46" stroke="#cf142b" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M27 41 Q60 5 93 41" stroke="#00247d" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M27 36 Q60 0 93 36" stroke="#ffcc00" stroke-width="5" fill="none" stroke-linecap="round"/>',
  lentes: (p, a) => {
    const [y, dx] = a.e;
    return `<g fill="none" stroke="${p.c}" stroke-width="2.6"><circle cx="${60 - dx}" cy="${y}" r="10"/><circle cx="${60 + dx}" cy="${y}" r="10"/><path d="M${70 - dx} ${y} Q60 ${y - 3} ${50 + dx} ${y}"/></g>`;
  },
  lentessol: (p, a) => {
    const [y, dx] = a.e;
    return `<g stroke="${p.c}" stroke-width="2.6"><circle cx="${60 - dx}" cy="${y}" r="10" fill="#1d1f24"/><circle cx="${60 + dx}" cy="${y}" r="10" fill="#1d1f24"/><path d="M${70 - dx} ${y} Q60 ${y - 3} ${50 + dx} ${y}" fill="none"/></g><path d="M${54 - dx} ${y - 4} Q${56 - dx} ${y - 7} ${61 - dx} ${y - 7}" stroke="#fff" stroke-width="1.6" fill="none" opacity=".7" stroke-linecap="round"/>`;
  },
  bufanda: (p) =>
    `<path d="M38 84 Q60 94 82 84 L82 92 Q60 102 38 92Z" fill="${p.c}"/><rect x="66" y="92" width="9" height="18" rx="3" fill="${p.c}"/><path d="M66 106 L75 106" stroke="${p.s}" stroke-width="2"/>`,
  panuelo: (p) => `<path d="M44 86 L76 86 L60 102Z" fill="${p.c}"/><circle cx="60" cy="88" r="3" fill="${p.s}"/>`,
  corbatin: (p) =>
    `<path d="M60 92 L48 86 L48 98Z M60 92 L72 86 L72 98Z" fill="${p.c}"/><circle cx="60" cy="92" r="3.4" fill="${p.s}"/>`,
  collar: () => seeds(),
  morral: (p) =>
    `<path d="M49 88 L47 124 M71 88 L73 124" stroke="${p.s}" stroke-width="7" stroke-linecap="round"/><path d="M49 88 L47 124 M71 88 L73 124" stroke="${p.c}" stroke-width="4.6" stroke-linecap="round"/>`,
  chaleco: () =>
    '<path d="M42 126 Q40 98 50 86 L57 86 L57 128 Q49 128 42 126Z" fill="#f59e0b"/><path d="M78 126 Q80 98 70 86 L63 86 L63 128 Q71 128 78 126Z" fill="#f59e0b"/><rect x="41" y="108" width="16" height="3.4" fill="#e8ecf2"/><rect x="63" y="108" width="16" height="3.4" fill="#e8ecf2"/>',
  brazalete: () =>
    '<g transform="rotate(-50 37 101)"><rect x="29" y="97" width="16" height="8" rx="2" fill="#f97316"/><rect x="29" y="100.1" width="16" height="1.8" fill="#e8ecf2"/></g>',
};

function piecePaint(p: Piece | undefined): Paint {
  const def = p ? itemDef(p.id) : undefined;
  return PAL[(p?.c ?? def?.def ?? "negro") as ColorId];
}
function layer(p: Piece | undefined, a: SpeciesArt): string {
  if (!p) return "";
  const draw = PIECES[p.id];
  return draw ? draw(piecePaint(p), a) : "";
}

/** El personaje entero, en un lienzo de 120 x 150. */
function figure(av: Avatar, m: Mood): string {
  const a = SPECIES_ART[av.sp];
  const shirt = SHIRTS[av.ropa.id] ?? SHIRTS.lisa!;
  const sp = piecePaint(av.ropa);
  const base = shirt.base(sp);
  // Feliz, saluda: es la misma celebración al guardar que al subir de nivel.
  const rightArm =
    m === "feliz"
      ? `<path d="M76 92 Q96 92 104 82" stroke="${base}" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="106" cy="79" r="6" fill="${a.skin}"/>`
      : `<path d="M76 92 Q88 100 90 112" stroke="${base}" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="90" cy="114" r="6" fill="${a.skin}"/>`;
  const legs =
    a.tail === "fluke"
      ? `<path d="M52 122 Q56 134 52 140 L68 140 Q64 134 68 122Z" fill="${a.skin}"/><path d="M36 142 Q60 128 84 142 Q60 148 36 142Z" fill="${a.skin}"/>`
      : a.tail === "coil"
        ? `<ellipse cx="60" cy="137" rx="32" ry="8" fill="${a.skin}"/><ellipse cx="60" cy="129" rx="22" ry="6" fill="#7a9a3e"/><g fill="#22260f"><ellipse cx="36" cy="137" rx="3.6" ry="2.4"/><ellipse cx="60" cy="141" rx="3.6" ry="2.4"/><ellipse cx="84" cy="137" rx="3.6" ry="2.4"/></g>`
        : `<rect x="46" y="120" width="11" height="18" rx="5.5" fill="${a.skin}"/><rect x="63" y="120" width="11" height="18" rx="5.5" fill="${a.skin}"/><ellipse cx="51" cy="138" rx="7.5" ry="4.2" fill="${a.skin}"/><ellipse cx="69" cy="138" rx="7.5" ry="4.2" fill="${a.skin}"/>`;
  const hat = av.cabeza
    ? `<g transform="translate(0 ${a.hy ?? 0}) translate(60 26) scale(1.16) translate(-60 -26)">${layer(av.cabeza, a)}</g>`
    : "";
  return (
    '<ellipse cx="60" cy="143" rx="28" ry="4.5" fill="#000" opacity=".1"/>' +
    legs +
    `<path d="M44 92 Q32 100 30 112" stroke="${base}" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="30" cy="114" r="6" fill="${a.skin}"/>` +
    rightArm +
    `<path d="M42 126 Q40 98 50 86 L70 86 Q80 98 78 126 Q60 131 42 126Z" fill="${base}"/>` +
    shirt.d(sp) +
    layer(av.cuerpo, a) +
    '<ellipse cx="60" cy="88" rx="20" ry="4.5" fill="#000" opacity=".13"/>' +
    a.head(m) +
    '<ellipse cx="50" cy="31" rx="20" ry="7" fill="#fff" opacity=".14"/>' +
    layer(av.cara, a) +
    hat +
    layer(av.cuello, a)
  );
}

function flowersRect(): string {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 6; i++) pts.push([6 + i * 18, 6], [6 + i * 18, 144]);
  for (let j = 1; j <= 6; j++) pts.push([6, 6 + j * 20.5], [114, 6 + j * 20.5]);
  return pts
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#f6c026"/><circle cx="${x}" cy="${y}" r="1.8" fill="#b7791f"/>`)
    .join("");
}
function flowersRing(): string {
  let s = "";
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2;
    const x = (60 + 41 * Math.cos(t)).toFixed(1);
    const y = (58 + 41 * Math.sin(t)).toFixed(1);
    s += `<circle cx="${x}" cy="${y}" r="4.4" fill="#f6c026"/><circle cx="${x}" cy="${y}" r="1.6" fill="#b7791f"/>`;
  }
  return s;
}

const cache = new Map<string, string>();
function memo(key: string, make: () => string): string {
  let v = cache.get(key);
  if (v === undefined) {
    v = make();
    if (cache.size > 300) cache.clear();
    cache.set(key, v);
  }
  return v;
}

/** De cuerpo entero (lienzo 120 x 150): el creador y el perfil. */
export function cardSvg(av: Avatar, m: Mood = "neutral"): string {
  return memo(`c|${JSON.stringify(av)}|${m}`, () => {
    const h = HAB[av.hab];
    return (
      `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect width="120" height="150" fill="${h.sky}"/>` +
      `<g transform="translate(0 34)"><path d="${h.d}" fill="${h.g}"/></g>` +
      figure(av, m) +
      (av.marco ? flowersRect() : "") +
      "</svg>"
    );
  });
}

/** Recortado a la cabeza, para un disco: la barra, el menú, las listas. */
export function discSvg(av: Avatar, m: Mood = "neutral"): string {
  return memo(`d|${JSON.stringify(av)}|${m}`, () => {
    const h = HAB[av.hab];
    return (
      `<svg viewBox="12 10 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="0" y="0" width="120" height="150" fill="${h.sky}"/>` +
      `<g transform="translate(0 20)"><path d="${h.d}" fill="${h.g}"/></g>` +
      figure(av, m) +
      (av.marco ? flowersRing() : "") +
      "</svg>"
    );
  });
}

/**
 * La escena del creador: el hábitat de borde a borde y el personaje parado en su suelo,
 * como en el selector de un videojuego. Lienzo de 200 de ancho; el suelo (dibujado para 120)
 * se estira a lo ancho.
 */
export function sceneSvg(av: Avatar, m: Mood = "neutral"): string {
  return memo(`s|${JSON.stringify(av)}|${m}`, () => {
    const h = HAB[av.hab];
    return (
      // Cielo de sobra arriba: si la caja es más ancha que la escena se recorta cielo, y el
      // sombrero más alto sigue entrando.
      `<svg viewBox="0 -34 200 194" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMax slice">` +
      `<rect y="-34" width="200" height="194" fill="${h.sky}"/>` +
      `<g transform="translate(0 46) scale(1.6667 1)"><path d="${h.d}" fill="${h.g}"/></g>` +
      `<g transform="translate(40 8)">${figure(av, m)}</g>` +
      "</svg>"
    );
  });
}

/**
 * Las fichas del creador: cada opción se enseña PUESTA en el personaje de la persona. Sin
 * paisaje detrás —el fondo lo pone la ficha, neutro—, salvo en la pestaña de hábitat,
 * donde el paisaje ES la opción. El encuadre depende de la zona: de los hombros para arriba
 * para la cabeza y la cara, el cuerpo entero para la ropa.
 */
const TILE_VIEW: Record<string, string> = {
  especie: "6 0 108 108",
  ropa: "-15 0 150 150",
  cabeza: "2 -10 116 116",
  cara: "6 0 108 108",
  cuello: "-4 4 128 128",
  cuerpo: "-15 0 150 150",
};
export function tileSvg(av: Avatar, view: string, m: Mood = "neutral"): string {
  return memo(`t|${view}|${JSON.stringify(av)}|${m}`, () => {
    if (view === "habitat") {
      const h = HAB[av.hab];
      return (
        `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">` +
        `<rect width="120" height="120" fill="${h.sky}"/><g transform="translate(0 6)"><path d="${h.d}" fill="${h.g}"/></g>` +
        `<g transform="translate(30 30) scale(.6)">${figure(av, m)}</g></svg>`
      );
    }
    return (
      `<svg viewBox="${TILE_VIEW[view] ?? TILE_VIEW.especie}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">` +
      figure(av, m) +
      "</svg>"
    );
  });
}
