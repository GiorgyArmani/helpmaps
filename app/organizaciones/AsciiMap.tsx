import type { CSSProperties, ReactNode } from "react";
import { BRAND, COUNTRY } from "@/config";
import { asciiMap, type DirectoryEntry } from "./directory";
import "./ascii-map.css";

/**
 * El país en ASCII, con los colores de la bandera: el mapa de `/inicio` y de
 * `/organizaciones`. Uno solo, para que las dos portadas dibujen el mismo país.
 *
 * Lo pinta el servidor: las filas en un SVG y las celdas vivas en HTML. `viewBox` es el
 * encuadre de `dotMap`. Lo que cada página pone encima (el zoom y el foco de la emergencia
 * en `/inicio`) entra por `className`, `style` y `children`. Lo encontrado al buscar en
 * `/organizaciones` lo pone encima el buscador (`OrgFinder`), en el cliente.
 */
export default function AsciiMap({
  entries,
  viewBox,
  label,
  className,
  style,
  children,
}: {
  entries: DirectoryEntry[];
  viewBox: string;
  label: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const flag = BRAND.flag ?? [];
  const vb = viewBox.split(" ").map(Number) as [number, number, number, number];
  const ascii = asciiMap(entries, COUNTRY.geo, viewBox, flag.length || 1);
  // Una posición del dibujo, en % del cuadro: las piezas en HTML caen sobre su celda.
  const at = (x: number, y: number) => ({
    left: `${(((x - vb[0]) / vb[2]) * 100).toFixed(2)}%`,
    top: `${(((y - vb[1]) / vb[3]) * 100).toFixed(2)}%`,
  });

  return (
    <div
      className={className ? `amap ${className}` : "amap"}
      style={{
        // La proporción del propio encuadre: el hueco está reservado antes de pintar.
        aspectRatio: vb.slice(2).join(" / "),
        // La letra de las celdas HTML, como fracción del ancho: la misma que en el SVG.
        ["--fs" as string]: (ascii.fontSize / vb[2]).toFixed(5),
        ...style,
      }}
    >
      {/* Lo que se acerca, junto: el dibujo y sus celdas vivas. */}
      <div className="amap-wrap">
        <svg viewBox={viewBox} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
          {/* El país en caracteres, fila a fila: aparecen como en una terminal. */}
          <g className="amap-ascii" fontSize={ascii.fontSize}>
            {ascii.rows.map((row, i) => (
              <g
                key={row.y}
                className="amap-row"
                // La franja de la bandera que le toca a esta fila (`brand.flag`).
                style={{ ["--r" as string]: i, ["--c" as string]: flag[row.band] }}
              >
                <text
                  className="amap-land"
                  x={ascii.x}
                  y={row.y}
                  textLength={ascii.width}
                  lengthAdjust="spacing"
                >
                  {row.land}
                </text>
                <text
                  className="amap-ink"
                  x={ascii.x}
                  y={row.y}
                  textLength={ascii.width}
                  lengthAdjust="spacing"
                >
                  {row.ink}
                </text>
              </g>
            ))}
          </g>
        </svg>
        {/* Las celdas vivas, en HTML y no en el SVG: cada una cambia su carácter
            (`content`) y repinta sólo su cuadrito. Dentro del SVG, cada cambio repintaba
            el mapa entero, y en un teléfono modesto eso se nota. */}
        {ascii.twinkles.length > 0 ? (
          <div className="amap-tws" aria-hidden="true">
            {ascii.twinkles.map((tw) => (
              <span
                key={`${tw.x}:${tw.y}`}
                style={{ ...at(tw.x, tw.y), ["--k" as string]: tw.k, ["--c" as string]: flag[tw.band] }}
              />
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
