"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/i18n/types";
import type { L10n, TourStep, TourCtl } from "@/features/tour/tourSteps";

// ---------------------------------------------------------------------------
// Interactive guided tour ENGINE (spotlight / coach-marks over the REAL controls).
// The step decks it renders live in tourSteps.ts (PUBLIC_STEPS / STAFF_STEPS).
//
// Instead of describing the app in the abstract, each step highlights the actual
// control, dims everything else, and leaves that control LIVE so the user can try it
// right there (the cutout is click-through; four transparent blockers swallow taps
// everywhere else so nobody gets lost mid-tour).
//
// How it works:
//   - Targets are found by a `data-tour="<id>"` attribute on the real element.
//     Nothing is positioned by hand.
//   - A step whose target doesn't exist right now is SKIPPED silently. That is not an
//     edge case: much of the UI is conditional (the rescatados bar needs rescatados,
//     the Voluntarios tab needs an admin, zoom buttons never render on phones).
//   - `before`/`after` let a step put the app in the state where its target is
//     visible (open the sheet, open the "+" menu, open the team panel on a tab) — the
//     tour drives the real app, it doesn't mock it.
//   - Anything that isn't a control (welcome, privacy, the rules) is a card step with
//     no anchor: full dim, same card.
//
// Mount it only while open (`{tourOpen && <GuidedTour …/>}`): unmounting is what
// resets it to step 1, so there is no open/close state to keep in sync.
// ---------------------------------------------------------------------------

const L = (o: L10n, lang: Lang) => o[lang];

const UI = {
  next: { es: "Siguiente", en: "Next", pt: "Próximo" },
  back: { es: "Atrás", en: "Back", pt: "Voltar" },
  skip: { es: "Saltar tutorial", en: "Skip tour", pt: "Pular tutorial" },
  start: { es: "Empezar", en: "Start", pt: "Começar" },
  done: { es: "Entendido", en: "Got it", pt: "Entendi" },
  close: { es: "Cerrar", en: "Close", pt: "Fechar" },
  docs: { es: "Ver documentación", en: "View documentation", pt: "Ver documentação" },
  login: { es: "Iniciar sesión", en: "Sign in", pt: "Entrar" },
  donate: { es: "Quiero donar", en: "I want to donate", pt: "Quero doar" },
  volunteer: { es: "Quiero ayudar", en: "I want to help", pt: "Quero ajudar" },
  of: { es: "de", en: "of", pt: "de" },
} as const;

type Rect = { top: number; left: number; width: number; height: number };

// Union of the rects of every element matching the step's anchor id(s). Returns null
// when nothing is on screen — a hidden control (display:none) reports a zero box, and
// that must read as "skip this step", not as a 0×0 ring in the corner.
function measure(anchor: string | string[] | undefined, pad: number): Rect | null {
  if (!anchor) return null;
  const ids = Array.isArray(anchor) ? anchor : [anchor];
  let top = Infinity,
    left = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const id of ids) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (top === Infinity) return null;
  return {
    top: Math.max(2, top - pad),
    left: Math.max(2, left - pad),
    width: Math.min(window.innerWidth - 4, right - left + pad * 2),
    height: Math.min(window.innerHeight - 4, bottom - top + pad * 2),
  };
}

export default function GuidedTour({
  steps,
  lang,
  ctl,
  onClose,
}: {
  steps: TourStep[]; // PUBLIC_STEPS or STAFF_STEPS (module constants → stable identity)
  lang: Lang;
  ctl: TourCtl;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  // Tagged with the step it belongs to: while a step is settling, the previous
  // step's ring must not be shown against the new copy.
  const [spot, setSpot] = useState<{ id: string; rect: Rect | null } | null>(null);
  const dir = useRef(1); // 1 = forward, -1 = back; drives which way we skip missing steps
  const beforeRan = useRef<string | null>(null); // last step whose `before` already ran
  // Both callers live in the parent and are rebuilt on every one of ITS renders. They are
  // held in refs so the step effect below can depend on the step alone: with `ctl`/`onClose`
  // in its dependency array, any parent re-render re-ran the step's `before()` — invisible
  // for an idempotent one, an infinite loop for the ficha step (it opens a RANDOM record,
  // so each run changed state, which re-rendered the parent, which re-ran the effect…).
  const ctlRef = useRef(ctl);
  const closeRef = useRef(onClose);
  useEffect(() => {
    ctlRef.current = ctl;
    closeRef.current = onClose;
  }, [ctl, onClose]);

  const step = steps[i];

  const finish = useCallback(() => {
    steps[i]?.after?.(ctlRef.current);
    closeRef.current();
  }, [i, steps]);

  // `after` touches the PARENT's state (it closes the "+" menu), so it must run here in
  // the event handler — never inside a setState updater, which React may replay during
  // render ("Cannot update a component while rendering a different component").
  const go = useCallback(
    (delta: number) => {
      dir.current = delta > 0 ? 1 : -1;
      const next = i + delta;
      if (next < 0 || next >= steps.length) return; // ends are handled by Done/Skip
      steps[i]?.after?.(ctlRef.current);
      setI(next);
    },
    [i, steps],
  );

  // Run the step's `before`, let the DOM settle (the sheet/menu animate), then measure.
  // If the target isn't there, keep moving in the direction we were going — a step for
  // a control this user doesn't have should never become a dead end.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    // Run `before` once per arrival at a step. React StrictMode mounts effects twice in
    // dev, which would otherwise open two different sample fichas back to back.
    if (beforeRan.current !== step.id) {
      beforeRan.current = step.id;
      step.before?.(ctlRef.current);
    }

    const settle = window.setTimeout(
      () => {
        if (cancelled) return;
        const ids = step.anchor ? (Array.isArray(step.anchor) ? step.anchor : [step.anchor]) : [];
        // Bring an off-screen target (e.g. a bar low in the scrolling list) into view first.
        const firstEl = ids.length ? document.querySelector<HTMLElement>(`[data-tour="${ids[0]}"]`) : null;
        if (firstEl) {
          const r = firstEl.getBoundingClientRect();
          if (r.height > 2 && (r.top < 8 || r.bottom > window.innerHeight - 8))
            firstEl.scrollIntoView({ block: "center" });
        }
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          const m = measure(step.anchor, step.pad ?? 8);
          if (step.anchor && !m && step.soft) {
            // Teaching step whose example isn't on screen right now → show it as a plain
            // card rather than dropping the concept from onboarding entirely.
            setSpot({ id: step.id, rect: null });
            return;
          }
          if (step.anchor && !m) {
            // Nothing to point at → skip. Undo whatever `before` set up first (a skipped
            // "+" step would otherwise leave its menu hanging open), then keep moving in
            // the direction we were going; at the ends, stop rather than loop.
            step.after?.(ctlRef.current);
            const next = i + dir.current;
            if (next >= 0 && next < steps.length) setI(next);
            else if (dir.current > 0) closeRef.current();
            else setSpot({ id: step.id, rect: null });
            return;
          }
          setSpot({ id: step.id, rect: m });
        });
      },
      step.before ? 260 : 40,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(settle);
    };
    // `step` is steps[i] from a module-level deck, so (i, step) identifies it. Nothing
    // from the parent belongs here: see the refs above.
  }, [i, step, steps]);

  // Keep the ring glued to its target while the user scrolls the list, taps the
  // highlighted control, or rotates the phone.
  useEffect(() => {
    if (!step?.anchor) return;
    const sync = () => setSpot({ id: step.id, rect: measure(step.anchor, step.pad ?? 8) });
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    const iv = window.setInterval(sync, 500); // catches CSS transitions + map moves
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
      window.clearInterval(iv);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, go]);

  if (!step) return null;

  const settled = spot?.id === step.id;
  const rect = settled ? spot.rect : null;
  const ready = settled;
  const last = i === steps.length - 1;
  const first = i === 0;
  // Dock the card away from the highlighted control: target up top → card at the
  // bottom, and vice versa. Cheaper and steadier than measuring the card itself.
  const dockTop = !!rect && rect.top + rect.height / 2 > window.innerHeight * 0.55;

  return (
    <div className="gt-root" role="dialog" aria-modal="true" aria-label={L(step.title, lang)}>
      {/* Four blockers around the cutout: they swallow stray taps on the rest of the
          UI while leaving the highlighted control itself live and tappable. */}
      {rect ? (
        <>
          <div className="gt-block" style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top) }} />
          <div className="gt-block" style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }} />
          <div className="gt-block" style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }} />
          <div
            className="gt-block"
            style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }}
          />
          <div
            className={"gt-ring" + (ready ? " gt-ring-in" : "")}
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          />
        </>
      ) : (
        <div className="gt-block gt-block-all" />
      )}

      <div className={"gt-card " + (dockTop ? "gt-card-top" : "gt-card-bottom")}>
        <div className="gt-progress" aria-hidden="true">
          <span className="gt-progress-fill" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>

        <div className="gt-head">
          <span className="gt-eyebrow">{L(step.eyebrow, lang)}</span>
          <span className="gt-count">
            {i + 1} {L(UI.of, lang)} {steps.length}
          </span>
          <button className="gt-x" onClick={finish} aria-label={L(UI.close, lang)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* Only this block scrolls. The actions row below stays pinned: on a short phone
            a long step used to push "Atrás"/"Siguiente" past the bottom of the screen. */}
        <div className="gt-scroll">
        <h2 className="gt-title">{L(step.title, lang)}</h2>
        <p className="gt-body">{L(step.body, lang)}</p>

        {step.bullets && (
          <ul className="gt-bullets">
            {step.bullets.map((b, n) => (
              <li key={n}>{L(b, lang)}</li>
            ))}
          </ul>
        )}

        {step.hint && rect && (
          <div className="gt-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 21h4" />
              <path d="M12 3a6 6 0 0 0-3.5 10.9c.3.3.5.7.5 1.1h6c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3Z" />
            </svg>
            {L(step.hint, lang)}
          </div>
        )}

        {step.cta === "donate" && (
          <button
            className="gt-cta"
            onClick={() => {
              finish();
              ctlRef.current.openDonate();
            }}
          >
            {L(UI.donate, lang)}
          </button>
        )}
        {step.cta === "volunteer" && (
          <button
            className="gt-cta"
            onClick={() => {
              finish();
              ctlRef.current.openVolunteer();
            }}
          >
            {L(UI.volunteer, lang)}
          </button>
        )}
        </div>

        <div className="gt-actions">
          {first ? (
            <button className="gt-skip" onClick={finish}>
              {L(UI.skip, lang)}
            </button>
          ) : (
            <button className="gt-back" onClick={() => go(-1)}>
              {L(UI.back, lang)}
            </button>
          )}
          <button className="gt-next" onClick={() => (last ? finish() : go(1))}>
            {last ? L(UI.done, lang) : first ? L(UI.start, lang) : L(UI.next, lang)}
          </button>
        </div>

        {/* Deeper reading, when the step points at a doc (the docs index for visitors,
            the volunteer manual for staff). No sign-in link: signing in from inside a
            tutorial is a strange place for it, and the header has a real button now. */}
        {step.docs && (
          <div className="gt-links">
            <a
              className="gt-link"
              href={`${step.docs}${lang === "es" ? "" : `?lang=${lang}`}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {L(UI.docs, lang)}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
