"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import { CONSENT_OPEN_EVENT, openConsent, saveConsent, useConsent, type Consent } from "./consent";

const noSubscribe = () => () => {};

/**
 * El aviso de cookies: una tarjeta CENTRADA sobre un velo, que se contesta de un toque.
 *
 * Centrado y no en una esquina por decisión del equipo (2026-09-13): abajo quedaba debajo del
 * pulgar pero fuera de la mirada, tapaba justo la lista del panel y se quedaba ahí mientras la
 * persona intentaba usar el mapa por detrás. En el centro se ve, se contesta y desaparece.
 * El coste es un toque, y cualquiera de los dos botones lo paga igual.
 *
 * «Rechazar» y «Aceptar» son el mismo botón con distinta palabra, a propósito. La AEPD pide
 * que rechazar cueste lo mismo que aceptar — mismo tamaño, mismo peso, misma capa — y un
 * aceptar negro relleno junto a un rechazar con borde es justo el patrón que sanciona. Por
 * eso tampoco se cierra tocando el velo ni con Escape: cerrar sin elegir no es ninguna de
 * las dos respuestas, y el aviso volvería a salir en la siguiente carga.
 *
 * Un despliegue sin `integrations.analytics.ga` no tiene nada que pedir y no lo enseña.
 */
export default function CookieConsent() {
  const site = useSite();
  const { t } = useI18n();
  const consent = useConsent();
  // La elección vive en el navegador: en el HTML del servidor el aviso no puede ir, o
  // aparecería un instante a quien ya contestó.
  const isClient = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [reopened, setReopened] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const show = Boolean(site.integrations.analytics.ga) && isClient && (consent === null || reopened);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  // Es un diálogo modal: el foco entra en él al abrirse, o quien navega con teclado o lector
  // de pantalla sigue en la página de detrás sin enterarse de que hay algo que contestar.
  useEffect(() => {
    if (show) ref.current?.querySelector<HTMLElement>(".ck-btn")?.focus();
  }, [show]);

  if (!show) return null;

  const choose = (value: Consent) => {
    saveConsent(value);
    setReopened(false);
  };

  // Tab no se escapa a la página de detrás, que el velo tapa pero no desactiva.
  const trapFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>("a[href], button")];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="ck-scrim">
      <div
        ref={ref}
        className="ck"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ck-title"
        aria-describedby="ck-text"
        onKeyDown={trapFocus}
      >
        <h2 id="ck-title" className="ck-title">
          {t("consent.title")}
        </h2>
        <p id="ck-text" className="ck-text">
          {t("consent.text")}{" "}
          <Link className="note-link" href="/docs/privacidad#cookies">
            {t("consent.more")}
          </Link>
        </p>
        <div className="ck-actions">
          <button type="button" className="btng btnsm ck-btn" onClick={() => choose("denied")}>
            {t("consent.reject")}
          </button>
          <button type="button" className="btng btnsm ck-btn" onClick={() => choose("granted")}>
            {t("consent.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * «Cookies» en un pie de página: vuelve a abrir el aviso. Retirar el permiso tiene que ser
 * tan fácil como darlo, así que va junto a «Privacidad» en cada pie, no enterrado en ajustes.
 * Hereda el aspecto de los enlaces vecinos por la clase que recibe (`:where(.ck-reopen)` no
 * pesa nada en la cascada).
 */
export function CookiePrefsLink({
  className = "",
  label,
  separator = false,
}: {
  className?: string;
  label?: string;
  /** El «·» de los pies que separan con punto: va aquí para no quedar huérfano sin GA. */
  separator?: boolean;
}) {
  const site = useSite();
  const { t } = useI18n();
  if (!site.integrations.analytics.ga) return null;
  return (
    <>
      {separator ? <span aria-hidden="true">·</span> : null}
      <button type="button" className={`ck-reopen ${className}`} onClick={openConsent}>
        {label ?? t("footer.cookies")}
      </button>
    </>
  );
}
