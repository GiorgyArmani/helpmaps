"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/ui/icons";
import { Spinner } from "@/ui/primitives";
import { useEmergency } from "@/features/app/SiteProvider";
import { newsEnabled } from "@/domain/news";
import BulletinBody from "@/features/news/BulletinBody";

/**
 * The bulletin, as a tab on the map.
 *
 * Same gesture as the layers tab: a lug on the right edge that unfolds into a panel. It is
 * on the map and not only on the entry page because most people never see the entry page —
 * it shows once per browser — and "what is being reported" is the question they arrive
 * with once the shelter list has answered the other one.
 *
 * The bulletin is fetched when the tab is FIRST opened, not on page load. It is a few
 * kilobytes of prose that nobody has asked for yet, on a connection where the map itself
 * is competing for bytes.
 */

interface Bulletin {
  generated_at: string;
  summary: string;
  sources: { name: string; error?: string }[];
  model: string | null;
}

export default function NewsTab() {
  const emergency = useEmergency();
  const [open, setOpen] = useState(false);
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
    // "ready" y no volver a "idle": el efecto depende del estado, así que devolverlo a
  // "idle" al terminar lo volvía a disparar — un bucle de peticiones a la API que además
  // dejaba el panel parpadeando entre carga y contenido para siempre.
  const [state, setState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");

  // La carga se dispara al abrir, UNA vez.
  //
  // Antes este efecto llamaba a `setState("loading")` y además dependía de `state`: se
  // reejecutaba en el acto, su limpieza marcaba la petición como cancelada, y el
  // resultado se descartaba. El panel se quedaba con el indicador de carga para siempre.
  // Ahora el estado inicial lo pone el clic, el efecto solo depende de `open`, y el
  // guardia por referencia evita una segunda petición si React lo monta dos veces.
  const started = useRef(false);

  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/news");
        const data = (await res.json()) as { bulletins?: Bulletin[] };
        if (cancelled) return;
        const latest = data.bulletins?.[0] ?? null;
        setBulletin(latest);
        setState(latest ? "ready" : "empty");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Sin medios declarados no hay boletín, y una pestaña que abre a un panel vacío es peor
  // que ninguna pestaña.
  if (!emergency || !newsEnabled(emergency.news)) return null;

  if (!open) {
    return (
      <div className="newsctl">
        <button
          type="button"
          className="sidetab"
          aria-expanded={false}
          aria-label="Qué se está reportando"
          title="Qué se está reportando"
          onClick={() => {
            setOpen(true);
            setState("loading");
          }}
        >
          <Icon.chevron className="sidetab-ch" />
          <span className="sidetab-txt">Noticias</span>
        </button>
      </div>
    );
  }

  return (
    <div className="newsctl newsctl-open">
      <button
        type="button"
        className="side-backdrop"
        aria-label="Cerrar"
        onClick={() => setOpen(false)}
      />
      <div className="side-panel" role="group" aria-label="Qué se está reportando">
        <div className="side-head">
          <b>Qué se está reportando</b>
          <button type="button" className="layers-x" aria-label="Cerrar" onClick={() => setOpen(false)}>
            <Icon.close />
          </button>
        </div>

        {state === "loading" ? <Spinner /> : null}
        {state === "error" ? <p className="layers-note">No se pudo cargar el boletín.</p> : null}
        {state === "empty" ? (
          <p className="layers-note">Todavía no se ha publicado ningún boletín.</p>
        ) : null}

        {bulletin ? (
          <>
            <time dateTime={bulletin.generated_at} className="side-when">
              {new Date(bulletin.generated_at).toLocaleString("es", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
            <BulletinBody text={bulletin.summary} />
            <p className="layers-src">
              {bulletin.model ? "Resumen automático de " : "Titulares de "}
              {bulletin.sources.filter((s) => !s.error).map((s) => s.name).join(", ")}.
              {bulletin.model ? " Puede contener errores: seguí el enlace al medio." : null}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
