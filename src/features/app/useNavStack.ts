"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── LA PILA DE PANTALLAS, REFLEJADA EN EL HISTORIAL ─────────────────────────────
//
// El mapa es UNA página: la ficha de un punto, Donar, Mi cuenta o el panel del equipo son
// estado de React, no rutas. Mientras eso fue un único `view`, el botón atrás del teléfono
// —el gesto con el que todo el mundo cierra algo— no cerraba nada: sacaba de la aplicación.
//
// Cada paso de esta pila es también una entrada del historial, y la pila entera viaja en
// `history.state`. Así el popstate no tiene que adivinar nada: sea atrás, adelante o un
// salto de varias entradas, la pila que corresponde está guardada en la propia entrada.
//
// Next intercepta `pushState`/`replaceState` y les añade su estado interno (`__NA`, el
// árbol), conservando lo que se le pase; sin eso, su popstate recargaría la página.

export interface NavEntry<V extends string> {
  view: V;
  /** El punto que muestra esa pantalla, si muestra uno. */
  id: string | null;
}

export interface NavStack<V extends string> {
  top: NavEntry<V>;
  /** La cima en este instante, para leerla desde un manejador sin cerrar sobre estado viejo. */
  current: () => NavEntry<V>;
  /** Un paso más hondo: Donar → Escríbenos, la lista → una ficha. */
  push: (entry: NavEntry<V>) => void;
  /** Sustituye la cima: de una ficha a otra no se acumulan diez «atrás». */
  replaceTop: (entry: NavEntry<V>) => void;
  /** Cambia de sitio: deja la pila en `[raíz, entry]`. Lo que se abre desde un menú. */
  openRoot: (entry: NavEntry<V>) => void;
  back: () => void;
  /** Vuelve a la raíz. */
  reset: () => void;
}

const KEY = "hmNav";

export function useNavStack<V extends string>({
  base,
  initial,
  urlFor,
}: {
  base: NavEntry<V>;
  initial: NavEntry<V>[];
  urlFor: (entry: NavEntry<V>) => string;
}): NavStack<V> {
  const [stack, setStack] = useState<NavEntry<V>[]>(() => (initial.length > 0 ? initial : [base]));
  const stackRef = useRef(stack);
  const baseRef = useRef(base);
  const urlForRef = useRef(urlFor);
  // Lo que hay que escribir cuando termine un salto de varias entradas (`history.go`), que
  // es asíncrono: hasta que no llega su popstate, la entrada actual es la de antes.
  const pendingRef = useRef<NavEntry<V>[] | null>(null);

  useEffect(() => {
    baseRef.current = base;
    urlForRef.current = urlFor;
  });

  const commit = useCallback((next: NavEntry<V>[]) => {
    stackRef.current = next;
    setStack(next);
  }, []);

  const write = useCallback((mode: "push" | "replace", next: NavEntry<V>[]) => {
    const top = next[next.length - 1] ?? baseRef.current;
    const url = urlForRef.current(top);
    if (mode === "push") window.history.pushState({ [KEY]: next }, "", url);
    else window.history.replaceState({ [KEY]: next }, "", url);
  }, []);

  // Una sola vez: la entrada con la que se cargó la página pasa a ser la raíz, y lo que
  // traía la URL (`?c=`, `?a=`) se apila encima. Así atrás desde un enlace compartido a un
  // punto vuelve al mapa, en vez de salir de la aplicación.
  //
  // ⚠️ En el SIGUIENTE turno de la cola, no en el efecto. Next instala su `pushState` /
  // `replaceState` en un efecto de su router, que es ANTEPASADO de este componente, y los
  // efectos corren de hijo a padre: escribir aquí usaba la versión sin parchear, que pisaba
  // la marca `__NA` de la entrada raíz. Al volver a esa entrada el popstate de Next no la
  // reconocía y RECARGABA la página entera. (No se cancela en el desmontaje: en modo
  // estricto el segundo montaje sale por `seeded` y la escritura no ocurriría nunca.)
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    window.setTimeout(() => {
      const s = stackRef.current;
      write("replace", s.slice(0, 1));
      for (let i = 1; i < s.length; i++) write("push", s.slice(0, i + 1));
    }, 0);
  }, [write]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        write("replace", pending);
        commit(pending);
        return;
      }
      const saved = (e.state as Record<string, unknown> | null)?.[KEY];
      commit(Array.isArray(saved) && saved.length > 0 ? (saved as NavEntry<V>[]) : [baseRef.current]);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [commit, write]);

  const current = useCallback(
    () => stackRef.current[stackRef.current.length - 1] ?? baseRef.current,
    [],
  );

  const push = useCallback(
    (entry: NavEntry<V>) => {
      const next = [...stackRef.current, entry];
      commit(next);
      write("push", next);
    },
    [commit, write],
  );

  const replaceTop = useCallback(
    (entry: NavEntry<V>) => {
      const s = stackRef.current;
      if (s.length <= 1) {
        push(entry);
        return;
      }
      const next = [...s.slice(0, -1), entry];
      commit(next);
      write("replace", next);
    },
    [commit, write, push],
  );

  const openRoot = useCallback(
    (entry: NavEntry<V>) => {
      const s = stackRef.current;
      const target = [s[0] ?? baseRef.current, entry];
      const depth = s.length - 1;
      commit(target);
      if (depth === 0) write("push", target);
      else if (depth === 1) write("replace", target);
      else {
        pendingRef.current = target;
        window.history.go(-(depth - 1));
      }
    },
    [commit, write],
  );

  const back = useCallback(() => {
    const s = stackRef.current;
    if (s.length <= 1) return;
    commit(s.slice(0, -1));
    window.history.back();
  }, [commit]);

  const reset = useCallback(() => {
    const s = stackRef.current;
    if (s.length <= 1) return;
    commit(s.slice(0, 1));
    window.history.go(-(s.length - 1));
  }, [commit]);

  const top = stack[stack.length - 1] ?? base;
  return useMemo(
    () => ({ top, current, push, replaceTop, openRoot, back, reset }),
    [top, current, push, replaceTop, openRoot, back, reset],
  );
}
