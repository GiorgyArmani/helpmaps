"use client";

import { useEffect, useRef, useState } from "react";

export interface TourStep {
  key: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  /** La pantalla del teléfono, pintada en el servidor (`Mockups.tsx`). */
  screen: React.ReactNode;
}

/**
 * Las funciones del perfil como un recorrido: la sección se queda fija mientras se hace
 * scroll, y cada tramo cambia a la vez el texto y la pantalla del teléfono.
 *
 * ── POR QUÉ ASÍ ─────────────────────────────────────────────────────────────
 *
 * Cuatro teléfonos apilados se leían como una galería de capturas. Uno solo que va
 * cambiando de pestaña se lee como la app EN USO: se ve moverse la pestaña, el toque sobre
 * ella y la pantalla que entra, que es justo lo que queremos que una coordinadora imagine
 * haciendo con su organización.
 *
 * ── CÓMO ────────────────────────────────────────────────────────────────────
 *
 * El contenedor mide un tramo de pantalla por paso y dentro va una capa `sticky`. El paso
 * activo sale de cuánto se ha recorrido el contenedor, leído en un `requestAnimationFrame`
 * y guardado sólo cuando cambia: un render por paso, no uno por píxel. Las transiciones son
 * de `transform` y `opacity`, que el navegador anima sin recalcular la página.
 *
 * Los cuatro textos y las cuatro pantallas están siempre en el marcado, apilados en la misma
 * celda de una rejilla: el hueco lo reserva el más alto y nada salta al cambiar. Un lector de
 * pantalla los lee todos, en orden; el teléfono es `aria-hidden` porque sólo ilustra.
 *
 * Con `prefers-reduced-motion` las transiciones las anula la regla global: el paso cambia
 * igual, sin movimiento.
 */
export default function FeatureTour({ steps }: { steps: TourStep[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
  }, [steps.length]);

  const pos = (i: number) => (i === active ? "on" : i < active ? "past" : "next");

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

        <div className="olp-feat-shot">
          <div className="olp-phone" aria-hidden="true" inert>
            <div className="olp-phone-scr">
              {steps.map((s, i) => (
                <div key={s.key} className="olp-scr" data-pos={pos(i)}>
                  {s.screen}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
