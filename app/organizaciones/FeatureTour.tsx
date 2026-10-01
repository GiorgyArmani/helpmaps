"use client";

import { useRef, useState } from "react";
import { Icon } from "@/ui/icons";

export interface TourStep {
  key: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  /** La pantalla del teléfono, pintada en el servidor (`Mockups.tsx`). */
  screen: React.ReactNode;
}

/**
 * Las funciones como un recorrido: un solo teléfono que va cambiando de pantalla, con el
 * texto de cada paso al lado.
 *
 * ── POR QUÉ ASÍ ─────────────────────────────────────────────────────────────
 *
 * Cuatro teléfonos apilados se leían como una galería de capturas. Uno solo que va
 * cambiando de pestaña se lee como la app EN USO: se ve moverse la pestaña, el toque sobre
 * ella y la pantalla que entra.
 *
 * ── LO MANEJA LA PERSONA ────────────────────────────────────────────────────
 *
 * En `/inicio` y en `/organizaciones`. Se probó que avanzara solo y el usuario lo descartó
 * el 2026-09-30: quien lee decide cuándo pasar. `/organizaciones` avanzaba con el scroll
 * (una capa `sticky` de una pantalla por paso) y el 2026-10-01 pasó a este mismo modo.
 *   - En escritorio, los pasos son una lista; tocar uno lo despliega y cambia la pantalla.
 *   - En el teléfono (2026-10-01), la lista desplegable hacía que todo cambiara de alto a
 *     cada toque y obligaba a subir y bajar. Ahora es un bloque fijo: una fila de iconos,
 *     UN texto (todos en la misma celda, así el hueco no cambia) y el teléfono. Tocar el
 *     teléfono pasa al siguiente y deslizarlo de lado va y vuelve, como en la app.
 *   - En los dos, anterior y siguiente bajo el teléfono.
 *
 * Las pantallas están siempre en el marcado, apiladas en la misma celda de una rejilla: el
 * hueco lo reserva la más alta y nada salta al cambiar. El teléfono es `aria-hidden` porque
 * sólo ilustra; lo que enseña lo dice el texto del paso.
 */
export default function FeatureTour({
  steps,
  manual,
}: {
  steps: TourStep[];
  /** Los rótulos de anterior y siguiente, para quien no ve las flechas. */
  manual: { prev: string; next: string };
}) {
  const [active, setActive] = useState(0);

  const pos = (i: number) => (i === active ? "on" : i < active ? "past" : "next");
  const go = (i: number) => setActive(Math.min(steps.length - 1, Math.max(0, i)));

  // Tocar o deslizar el teléfono. `touch-action: pan-y` (orgs.css) deja el scroll vertical
  // al navegador y nos da el gesto horizontal. Un toque sin desplazamiento avanza (y del
  // último vuelve al primero); las flechas tienen su propio clic y se ignoran aquí.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".olp-tour-nav")) return;
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(active + (dx < 0 ? 1 : -1));
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) setActive((active + 1) % steps.length);
  };

  const phone = (
    <div className="olp-phone" aria-hidden="true" inert>
      <div className="olp-phone-scr">
        {steps.map((s, i) => (
          <div key={s.key} className="olp-scr" data-pos={pos(i)}>
            {s.screen}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="olp-tour olp-tour-manual">
      <div className="olp-tour-pin">
        <ol className="olp-stepper">
          {steps.map((s, i) => {
            const on = i === active;
            return (
              <li key={s.key} className="olp-stepper-item" data-on={on ? "" : undefined}>
                <button
                  type="button"
                  className="olp-stepper-btn"
                  aria-expanded={on}
                  aria-controls={`olp-step-${s.key}`}
                  onClick={() => setActive(i)}
                >
                  <span className="olp-stepper-ic" aria-hidden="true">
                    {s.icon}
                  </span>
                  <span className="olp-stepper-t">{s.title}</span>
                </button>
                {/* Siempre en el marcado: se despliega con `grid-template-rows`, sin medir. */}
                <div id={`olp-step-${s.key}`} className="olp-stepper-body">
                  <p className="olp-stepper-d">{s.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Sólo en el teléfono: los pasos como iconos y un solo texto, en un hueco fijo. */}
        <div className="olp-tour-m">
          <div className="olp-tour-ics">
            {steps.map((s, i) => (
              <button
                key={s.key}
                type="button"
                className="olp-tour-ic"
                aria-label={s.title}
                aria-pressed={i === active}
                onClick={() => go(i)}
              >
                {s.icon}
              </button>
            ))}
          </div>
          <div className="olp-tour-texts" aria-live="polite">
            {steps.map((s, i) => (
              <article
                key={s.key}
                className="olp-tour-text"
                data-pos={pos(i)}
                aria-hidden={i !== active}
              >
                <h3 className="olp-feat-t">{s.title}</h3>
                <p className="olp-feat-d">{s.desc}</p>
              </article>
            ))}
          </div>
        </div>

        <div
          className="olp-feat-shot"
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (swipe.current = null)}
        >
          {phone}
          <div className="olp-tour-nav">
            <button
              type="button"
              className="olp-tour-arrow"
              aria-label={manual.prev}
              disabled={active === 0}
              onClick={() => go(active - 1)}
            >
              <Icon.back width={20} height={20} />
            </button>
            <span className="olp-tour-count" aria-hidden="true">
              {active + 1} / {steps.length}
            </span>
            <button
              type="button"
              className="olp-tour-arrow"
              aria-label={manual.next}
              disabled={active === steps.length - 1}
              onClick={() => go(active + 1)}
            >
              <Icon.chevron width={20} height={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
