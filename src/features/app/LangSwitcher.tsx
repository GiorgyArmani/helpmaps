"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { FLAG_ICON, LANG_NAME } from "@/ui/flags";

/**
 * Language switcher: la bandera, y nada más.
 *
 * Ported from the original app, including the reason it is a menu and not three pills:
 * with three languages plus flag swatches, always-visible buttons did not fit a phone
 * header next to search, help and the staff gear, and something got clipped.
 *
 * ── POR QUÉ SE FUERON EL CÓDIGO Y EL GALÓN ──────────────────────────────────
 *
 * El botón llevaba bandera + "ES" + un galón, y era el elemento más ancho de la fila de
 * acciones para decir lo que la bandera ya decía. Esa anchura se paga entera en la barra
 * angosta, donde el buscador es lo que se queda sin sitio — y el buscador es la razón por
 * la que alguien abre esto.
 *
 * El código no informaba de nada que la bandera no dijera, y el galón prometía un menú que
 * de todas formas se descubre tocando. La regla de CSS que ya escondía las dos cosas por
 * debajo de 360px hacía esta misma cuenta; ahora vale para todos los anchos.
 *
 * El nombre completo del idioma sigue existiendo: está en el menú, y en el `aria-label`,
 * que es lo que oye quien no ve la bandera.
 */

export default function LangSwitcher() {
  const { lang, setLang, available } = useI18n();
  const [open, setOpen] = useState(false);

  if (available.length < 2) return null;

  return (
    <div className="langwrap" data-tour="lang">
      {open ? (
        <button
          type="button"
          className="lang-backdrop"
          aria-label="Cerrar"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <button
        type="button"
        className={`langbtn${open ? " langbtn-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={LANG_NAME[lang]}
        title={LANG_NAME[lang]}
      >
        <span className="lg-flag lg-flag-btn">{FLAG_ICON[lang]}</span>
      </button>

      {open ? (
        <div className="lang-menu" role="menu">
          {available.map((l) => (
            <button
              key={l}
              type="button"
              role="menuitem"
              className={`lang-opt${l === lang ? " lang-opt-on" : ""}`}
              onClick={() => {
                setLang(l);
                setOpen(false);
              }}
            >
              <span className="lg-flag lg-flag-lg">{FLAG_ICON[l]}</span>
              <span className="lang-opt-name">{LANG_NAME[l]}</span>
              {l === lang ? (
                <span className="lang-opt-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
