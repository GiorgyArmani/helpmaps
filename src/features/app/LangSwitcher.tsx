"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { FLAG_ICON, LANG_NAME } from "@/ui/flags";

/**
 * Language switcher: one button (flag + code) that opens a small menu.
 *
 * Ported from the original app, including the reason it is a menu and not three pills:
 * with three languages plus flag swatches, always-visible buttons did not fit a phone
 * header next to search, help and the staff gear, and something got clipped.
 *
 * On the narrowest phones the code and chevron are hidden by CSS and only the flag
 * remains — nothing is lost, the names are still in the menu, one tap away.
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
      >
        <span className="lg-flag lg-flag-lg">{FLAG_ICON[lang]}</span>
        <span className="langbtn-code">{lang.toUpperCase()}</span>
        <svg className="langbtn-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
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
