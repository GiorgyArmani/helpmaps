/**
 * Types the ported tour deck refers to.
 *
 * `GuidedTour.tsx` is the engine, ported unchanged. `tourSteps.ts` is the copy, written
 * for the template — it explains finding help and offering it, without naming a country.
 * This file declares the staff-panel tab ids a deck may name, including ones this base
 * does not implement yet, so a clone can add a step before it adds the screen.
 *
 * A step whose anchor is not on screen is skipped silently by the engine, which is
 * exactly why the full deck can be carried unchanged: the steps about people, lists and
 * rescued records simply do not appear until a clone turns those features on and renders
 * elements with the matching `data-tour` ids.
 */
export type AdminTab =
  | "novedades"
  | "centros"
  | "personas"
  | "voluntarios"
  | "listas"
  | "donaciones"
  | "rescatados"
  | "reportes";
