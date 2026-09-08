"use client";

import { useState } from "react";

/**
 * Las pestañas del perfil de un punto.
 *
 * ── POR QUÉ DEJA DE SER UN ROLLO ────────────────────────────────────────────
 *
 * La ficha de una iniciativa con vida —campañas, agenda, publicaciones, datos de aporte—
 * llegaba a medir varias pantallas de scroll continuo, y todo con el mismo peso. Para
 * saber si tienen una campaña abierta había que bajar pasando por el horario, la
 * dirección y los insumos que reciben. Explorar era imposible: no se podía volver a algo
 * que ya se había visto sin buscarlo otra vez con el pulgar.
 *
 * Es el mismo problema que resolvieron los mapas grandes con pestañas, y por la misma
 * razón: un perfil no es un documento que se lee de arriba abajo, es un sitio donde se
 * BUSCA una cosa concreta. Las pestañas convierten «bajar hasta encontrarlo» en «tocar
 * dónde está».
 *
 * ── SÓLO APARECEN SI HAY DE QUÉ ─────────────────────────────────────────────
 *
 * La lista se construye con lo que ese punto TIENE. Un acopio importado sin campañas ni
 * publicaciones no recibe ninguna pestaña y se dibuja exactamente igual que antes —una
 * sola columna—, que es lo correcto para la gran mayoría de los puntos del mapa. Poner
 * cuatro pestañas de las que tres están vacías es prometer un perfil que no existe, y
 * obliga a tocar tres veces para descubrir que no había nada.
 *
 * ── LA PRIMERA ES SIEMPRE «INFORMACIÓN» ─────────────────────────────────────
 *
 * Quien abre la ficha de un refugio a las once de la noche viene a ver si está abierto y
 * dónde queda. Eso no puede estar detrás de un toque, ni siquiera en el perfil más
 * completo. Lo demás se explora; esto se consulta.
 */
export interface ProfileTab {
  id: string;
  label: string;
  /** Se pinta junto al nombre. `null` cuando contar no aporta (la información no se cuenta). */
  count: number | null;
  content: React.ReactNode;
}

export default function ProfileTabs({
  tabs,
  initial,
}: {
  tabs: ProfileTab[];
  /**
   * Con cuál abrir. La usa la página pública cuando el enlace apunta a una publicación
   * concreta: llegar a `#p-<id>` y encontrarse la pestaña «Información» sería llegar a un
   * sitio donde lo que te trajo no está.
   */
  initial?: string;
}) {
  // La abierta se guarda POR LISTA DE PESTAÑAS, no suelta: al pasar de un punto a otro la
  // ficha cambia entera y la tercera pestaña del anterior puede no existir en el nuevo.
  // Derivarlo aquí evita corregirlo después desde un efecto, que encadena un render de más
  // y deja un parpadeo con el contenido equivocado.
  const clave = tabs.map((t) => t.id).join("|");
  const primera = (initial && tabs.some((t) => t.id === initial) ? initial : tabs[0]?.id) ?? "";
  const [abierta, setAbierta] = useState<{ clave: string; id: string }>({
    clave,
    id: primera,
  });
  const activa = abierta.clave === clave ? abierta.id : primera;
  const actual = tabs.find((t) => t.id === activa) ?? tabs[0];

  if (tabs.length <= 1) return <>{tabs[0]?.content ?? null}</>;

  return (
    <>
      {/* Pegajosa: en una lista larga de publicaciones, perder la fila de pestañas al bajar
          obliga a subir del todo para cambiar de sección — que es justo el scroll que estas
          pestañas venían a quitar. */}
      <div className="ptabs2" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activa}
            className={`ptab2${tab.id === activa ? " ptab2-on" : ""}`}
            onClick={() => setAbierta({ clave, id: tab.id })}
          >
            {tab.label}
            {tab.count === null ? null : <span className="ptab2-n">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel">{actual?.content}</div>
    </>
  );
}
