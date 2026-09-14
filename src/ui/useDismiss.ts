"use client";

import { useEffect, useId, useRef, type RefObject } from "react";

// ── CÓMO SE CIERRA UN DESPLEGABLE ───────────────────────────────────────────────
//
// Cada menú resolvía esto a su manera, y en ninguno funcionaba del todo:
//
//   • Con un botón transparente a pantalla completa detrás del menú. Pero los menús de la
//     barra viven dentro de `.topbar`, que tiene su propio contexto de apilamiento (z 600):
//     su «pantalla completa» quedaba POR DEBAJO de la hoja de puntos (630 en teléfono) y
//     de las lengüetas del canto. Tocar la lista o el mapa no cerraba nada — y ese mismo
//     fondo tapaba el avatar, así que volver a tocarlo tampoco cerraba su menú.
//   • Escape sólo lo atendían el selector de puntos y el recorrido guiado.
//   • Nada impedía tener Capas, Noticias y el menú del avatar abiertos a la vez.
//
// Aquí se escucha en el DOCUMENTO, que no sabe de capas: un toque fuera del envoltorio del
// menú lo cierra esté donde esté, Escape lo cierra, el botón atrás del teléfono lo cierra,
// y abrir un menú cierra el que hubiera abierto. El botón que lo abre va DENTRO del
// envoltorio, así que tocarlo otra vez lo cierra con su propio `onClick`.
//
// El toque de fuera NO se traga: si cae sobre un pin, el menú se cierra y el pin se abre.
// Un fondo que se come el primer toque obliga a tocar dos veces lo que se quería tocar.

const OPEN_EVENT = "helpmaps:layer-open";

export function useDismiss(
  open: boolean,
  close: () => void,
  ref: RefObject<HTMLElement | null>,
) {
  const id = useId();
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    if (!open) return;
    // Anunciarse: el menú que estuviera abierto se cierra al oírlo.
    window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: id }));

    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) closeRef.current();
    };
    const onPointer = (e: PointerEvent) => {
      // El recorrido guiado abre menús para enseñarlos y se maneja con su propia tarjeta,
      // que queda por encima: tocar «Siguiente» no es tocar fuera del menú, y cerrarlo ahí
      // dejaba el anillo del paso rodeando un hueco vacío.
      if ((e.target as Element | null)?.closest?.(".gt-root")) return;
      const root = ref.current;
      if (root && !root.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    const onPop = () => closeRef.current();

    window.addEventListener(OPEN_EVENT, onOther);
    // En captura: un componente que detenga la propagación de su propio toque no puede
    // dejar un menú colgado.
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOther);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
  }, [open, id, ref]);
}
