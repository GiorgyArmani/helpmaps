"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import { Spinner } from "@/ui/primitives";
import { useEmergency } from "@/features/app/SiteProvider";
import { newsEnabled } from "@/domain/news";
import BulletinBody from "@/features/news/BulletinBody";
import SideTab from "@/ui/SideTab";

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
  const { t, lang } = useI18n();
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

  return (
    <SideTab
      className={`newsctl${open ? " newsctl-open" : ""}`}
      panelClassName="side-panel"
      headClassName="side-head"
      label={t("news.tab")}
      title={t("news.title")}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // El indicador de carga lo enciende el CLIC, no el efecto. Ponerlo dentro del
        // efecto lo hacía depender de `state`, y su propia limpieza cancelaba la
        // petición en vuelo: el panel se quedaba girando para siempre.
        if (next) setState("loading");
      }}
    >
      {state === "loading" ? <Spinner /> : null}
      {state === "error" ? <p className="layers-note">{t("news.error")}</p> : null}
      {state === "empty" ? <p className="layers-note">{t("news.empty")}</p> : null}

      {bulletin ? (
        <>
          {/* La fecha en el idioma que se está leyendo: estaba fijada en "es", así que
              un lector en inglés veía "22 sept, 14:05" en medio de texto en inglés. */}
          <time dateTime={bulletin.generated_at} className="side-when">
            {new Date(bulletin.generated_at).toLocaleString(lang, {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          <BulletinBody text={bulletin.summary} />
          <p className="layers-src">
            {t(bulletin.model ? "news.srcAuto" : "news.srcHeadlines", {
              sources: bulletin.sources
                .filter((s) => !s.error)
                .map((s) => s.name)
                .join(", "),
            })}
            {bulletin.model ? ` ${t("news.autoWarn")}` : null}
          </p>
        </>
      ) : null}
    </SideTab>
  );
}
