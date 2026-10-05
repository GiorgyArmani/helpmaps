"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LocationType } from "@/domain/types";
import { Icon } from "@/ui/icons";
import { searchDirectory } from "./search";
import OrgRegister from "./OrgRegister";

// El mapa de verdad (Leaflet) llega aparte: mientras, su hueco exacto en esqueleto.
const OrgMap = dynamic(() => import("./OrgMap"), {
  ssr: false,
  loading: () => <div className="olp-rmap skel" aria-hidden="true" />,
});

/** Un lugar, ya listo para pintarse: el texto lo prepara el servidor en su idioma. */
export interface FinderEntry {
  id: string;
  name: string;
  /** «Centro de acopio, Chacao, Miranda». */
  desc: string;
  type: LocationType;
  /** Dónde está; sin él (una iniciativa digital), no va en el mapa. */
  at: [number, number] | null;
}

export interface FinderLabels {
  mapLabel: string;
  close: string;
  findTitle: string;
  findHint: string;
  findLabel: string;
  findPlaceholder: string;
  findCta: string;
  /** Con `{n}`. */
  results: string;
  /** Con `{q}`. */
  none: string;
  mine: string;
  missing: string;
  missingCta: string;
}

/**
 * El mapa y el buscador de `/organizaciones`, juntos porque lo que se escribe en uno se
 * enciende en el otro.
 *
 * ── MIENTRAS SE ESCRIBE ─────────────────────────────────────────────────────
 *
 * Antes había que tocar «Buscar», la página se recargaba y sólo entonces salían los
 * resultados: con mala señal, una espera por cada intento. Ahora filtra en el teléfono, a
 * cada tecla, sobre la lista que la página ya trajo (unos cientos de nombres). `?q=` se
 * sigue escribiendo en la dirección —sin recargar— para que el enlace se pueda mandar ya
 * hecho, y sin JavaScript el formulario sigue funcionando como antes.
 */
export default function OrgFinder({
  entries,
  initialQuery,
  labels,
  missingHref,
  lang,
}: {
  entries: FinderEntry[];
  initialQuery: string;
  labels: FinderLabels;
  missingHref: string;
  /** El idioma, si no es el de siempre: viaja en el formulario cuando no hay JavaScript. */
  lang?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const q = query.trim();
  const hits = useMemo(() => searchDirectory(entries, q), [entries, q]);
  const searching = q.length >= 2;
  const input = useRef<HTMLInputElement>(null);
  // El alta, abierta a mano desde «¿No aparece?». Sin resultados se abre sola.
  const [registering, setRegistering] = useState(false);
  const notFound = searching && hits.length === 0;
  const showRegister = registering || notFound;
  const placed = useMemo(
    () => entries.flatMap((e) => (e.at ? [{ id: e.id, name: e.name, desc: e.desc, type: e.type, lat: e.at[0], lng: e.at[1] }] : [])),
    [entries],
  );

  // La dirección acompaña a lo escrito, sin recargar y sin llenar el historial.
  useEffect(() => {
    const id = setTimeout(() => {
      const url = new URL(window.location.href);
      if (searching) url.searchParams.set("q", q);
      else url.searchParams.delete("q");
      window.history.replaceState(window.history.state, "", url);
    }, 300);
    return () => clearTimeout(id);
  }, [q, searching]);

  return (
    <>
      <figure className="olp-map">
        <div className="olp-map-box">
          <OrgMap
            entries={placed}
            hits={searching ? hits.map((h) => h.id) : null}
            label={labels.mapLabel}
            mine={labels.mine}
            close={labels.close}
          />
        </div>
      </figure>

      {/* El buscador: la acción de la página. En el teléfono se monta sobre el borde del
          mapa; en escritorio queda bajo el titular, con el mapa a la derecha. */}
      <section id="buscar" className="olp-find" aria-labelledby="olp-find-h">
        <h2 id="olp-find-h" className="olp-find-h">
          {labels.findTitle}
        </h2>
        <p className="olp-find-p">{labels.findHint}</p>
        {/* Sin JavaScript, el formulario manda `?q=` como siempre. Con él, «Buscar» sólo
            cierra el teclado: los resultados ya están a la vista. */}
        <form
          className="olp-form"
          action="/organizaciones#buscar"
          method="get"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            input.current?.blur();
          }}
        >
          {lang ? <input type="hidden" name="lang" value={lang} /> : null}
          <label className="olp-sr" htmlFor="olp-q">
            {labels.findLabel}
          </label>
          <input
            ref={input}
            id="olp-q"
            className="olp-input"
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 80))}
            placeholder={labels.findPlaceholder}
            autoComplete="organization"
            enterKeyHint="search"
            maxLength={80}
          />
          <button type="submit" className="olp-go">
            <Icon.search width={18} height={18} />
            <span className="olp-go-t">{labels.findCta}</span>
          </button>
        </form>

        {/* Siempre en el marcado: el lector de pantalla anuncia cada cambio de la cuenta. */}
        <div aria-live="polite">
          {searching ? (
            hits.length > 0 ? (
              <>
                <p className="olp-count">{labels.results.replace("{n}", String(hits.length))}</p>
                <ul className="olp-hits">
                  {hits.map((h) => (
                    <li key={h.id}>
                      {/* Sin precarga: los resultados cambian a cada tecla, y precargar la
                          ficha de cada uno gastaba datos en fichas que nadie iba a abrir. */}
                      <Link
                        className="olp-hitrow"
                        href={`/c/${encodeURIComponent(h.id)}?gestionar=1`}
                        prefetch={false}
                      >
                        <span className="olp-hitrow-txt">
                          <span className="olp-hitrow-n">{h.name}</span>
                          <span className="olp-hitrow-d">{h.desc}</span>
                        </span>
                        <span className="olp-hitrow-go">
                          {labels.mine}
                          <Icon.chevron width={16} height={16} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="olp-count">{labels.none.replace("{q}", q)}</p>
            )
          ) : null}
        </div>

        {/* El alta, aquí mismo: con el nombre que se acaba de buscar. Se monta de nuevo si
            cambia la búsqueda, para que el nombre siga a lo escrito. */}
        {showRegister ? (
          <OrgRegister
            key={notFound ? q : "manual"}
            initialName={q}
            onCancel={notFound ? undefined : () => setRegistering(false)}
          />
        ) : (
          <p className="olp-missing">
            {labels.missing}{" "}
            {/* Sin JavaScript, el enlace lleva al formulario de la app, como antes. */}
            <a
              href={missingHref}
              onClick={(e) => {
                e.preventDefault();
                setRegistering(true);
              }}
            >
              {labels.missingCta}
            </a>
          </p>
        )}
      </section>
    </>
  );
}
