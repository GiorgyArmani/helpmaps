"use client";

import type { Avatar } from "@/domain/avatar";
import { AvatarDisc } from "@/features/avatar/AvatarArt";

/** Cuántas caras caben antes de que la fila deje de leerse como «gente» y sea ruido. */
export const PILE_MAX = 5;

/**
 * Los seguidores de una organización como una fila de sus animalitos, solapados, con el
 * número al lado. Cada persona que se suma pone el suyo delante.
 *
 * Las caras son decoración: el número escrito es lo que lee un lector de pantalla, así que
 * van mudas. `faces` en `null` es «todavía cargando» y dibuja el hueco que ocupará, para
 * que la línea no aparezca de golpe empujando lo de abajo.
 */
export default function FollowersPile({
  faces,
  label,
  suffix,
}: {
  faces: Avatar[] | null;
  label: string | null;
  suffix?: string | null;
}) {
  if (faces === null) {
    return (
      <p className="fpile" aria-hidden="true">
        <span className="skel fpile-skel" />
      </p>
    );
  }
  if (!label && !suffix) return null;
  const shown = faces.slice(0, PILE_MAX);
  return (
    <p className="fpile small mut">
      {shown.length ? (
        <span className="fpile-faces" aria-hidden="true">
          {shown.map((av, i) => (
            <span key={i} className="fpile-face">
              <AvatarDisc avatar={av} label={null} />
            </span>
          ))}
        </span>
      ) : null}
      <span>{[label, suffix].filter(Boolean).join(" · ")}</span>
    </p>
  );
}
