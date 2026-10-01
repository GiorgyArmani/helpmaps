"use client";

import { useEffect, useRef, useState } from "react";
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
 * ── DOS MODOS ───────────────────────────────────────────────────────────────
 *
 * Por scroll (`/organizaciones`): el contenedor mide un tramo de pantalla por paso y dentro
 * va una capa `sticky`; el paso sale de cuánto se ha recorrido, leído en un
 * `requestAnimationFrame` y guardado sólo cuando cambia.
 *
 * Manual (`manual`, en `/inicio`): lo maneja la persona. Los pasos son una lista; tocar uno
 * lo despliega con su texto y cambia la pantalla. Bajo el teléfono, anterior y siguiente,
 * para no tener que subir a la lista en el móvil. Se probó antes que avanzara solo y el
 * usuario lo descartó el 2026-09-30: quien lee decide cuándo pasar.
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
  /** Con él, el recorrido lo maneja la persona y no el scroll; trae los rótulos de las flechas. */
  manual?: { prev: string; next: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || manual) return;
    let frame = 0;
    let last = -1;

    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const run = r.height - window.innerHeight;
      const p = run > 0 ? Math.min(Math.max(-r.top / run, 0), 0.9999) : 0;
      const i = Math.floor(p * steps.length);
      if (i !== last) {
        last = i;
        setActive(i);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [steps.length, manual]);

  const pos = (i: number) => (i === active ? "on" : i < active ? "past" : "next");

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

  if (manual) {
    return (
      <div ref={ref} className="olp-tour olp-tour-manual">
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

          <div className="olp-feat-shot">
            {phone}
            <div className="olp-tour-nav">
              <button
                type="button"
                className="olp-tour-arrow"
                aria-label={manual.prev}
                disabled={active === 0}
                onClick={() => setActive((a) => Math.max(0, a - 1))}
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
                onClick={() => setActive((a) => Math.min(steps.length - 1, a + 1))}
              >
                <Icon.chevron width={20} height={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="olp-tour" style={{ ["--steps" as string]: steps.length }}>
      <div className="olp-tour-pin">
        <div className="olp-tour-copy">
          <div className="olp-tour-dots" aria-hidden="true">
            {steps.map((s, i) => (
              <span key={s.key} className={i <= active ? "is-done" : undefined} />
            ))}
          </div>
          <div className="olp-tour-texts">
            {steps.map((s, i) => (
              <article key={s.key} className="olp-tour-text" data-pos={pos(i)}>
                <span className="olp-feat-ic" aria-hidden="true">
                  {s.icon}
                </span>
                <h3 className="olp-feat-t">{s.title}</h3>
                <p className="olp-feat-d">{s.desc}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="olp-feat-shot">{phone}</div>
      </div>
    </div>
  );
}
