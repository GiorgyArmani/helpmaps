"use client";

import { useMemo, useState } from "react";
import { RECEIVES_PRESETS, sameSupply } from "@/domain/needs";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";

/**
 * Elegir qué recibe un punto, tocando en vez de escribiendo.
 *
 * ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────
 *
 * Este campo era un cuadro de texto donde había que teclear cada insumo separado por
 * comas. Es el campo que MÁS cambia de toda la ficha y el que alguien actualiza desde un
 * teléfono, de pie en un refugio: escribir «agua, ropa, medicamentos, alimentos no
 * perecederos» a mano, cada vez, es la parte lenta de mantener el mapa al día.
 *
 * Los quince chips son los quince insumos más repetidos entre los puntos ya publicados
 * —contados de la base, no inventados; ver `src/domain/needs.ts`— así que en la mayoría
 * de los casos el campo se llena con tres toques.
 *
 * ── SE SIGUE PUDIENDO ESCRIBIR, Y NO ES UN AÑADIDO ──────────────────────────
 *
 * Lo escrito a mano vale igual que un chip y se guarda igual: `receives` es texto libre y
 * lo sigue siendo. Una lista cerrada dejaría fuera justo el insumo que hace falta hoy —el
 * que nadie previó— que en una emergencia es el que importa.
 *
 * Por eso, además, los valores que ya están guardados y NO coinciden con ningún preset se
 * muestran como chips propios en vez de desaparecer: en la base hay cientos escritos a
 * mano a lo largo de meses, con sus variantes y sus erratas, y este componente no puede
 * ser el que los borre al abrir la ficha y volver a guardar.
 */
export default function SupplyPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  const presets = useMemo(
    () => RECEIVES_PRESETS.map((key) => ({ key, label: t(key) })),
    [t],
  );

  // Lo guardado que no es ninguno de los presets: se conserva y se puede quitar.
  const extras = useMemo(
    () => value.filter((v) => !presets.some((p) => sameSupply(p.label, v))),
    [value, presets],
  );

  const has = (label: string) => value.some((v) => sameSupply(v, label));

  function toggle(label: string) {
    onChange(has(label) ? value.filter((v) => !sameSupply(v, label)) : [...value, label]);
  }

  function addOwn() {
    const clean = draft.trim();
    if (!clean || has(clean)) {
      setDraft("");
      return;
    }
    onChange([...value, clean]);
    setDraft("");
  }

  return (
    <div className="sup">
      <p className="fhint sup-hint">{t("supply.pickerHint")}</p>

      <div className="sup-chips">
        {presets.map(({ key, label }) => {
          const on = has(label);
          return (
            <button
              key={key}
              type="button"
              className={`sup-chip${on ? " sup-chip-on" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(label)}
            >
              {on ? <Icon.check /> : null}
              {label}
            </button>
          );
        })}

        {/* Lo que ya estaba escrito y no es preset. Con la cruz para quitarlo, porque si
            no habría que borrarlo desde un campo de texto que ya no existe. */}
        {extras.map((label) => (
          <button
            key={label}
            type="button"
            className="sup-chip sup-chip-on sup-chip-own"
            aria-pressed
            onClick={() => toggle(label)}
            title={t("common.delete")}
          >
            {label}
            <Icon.close />
          </button>
        ))}
      </div>

      <div className="sup-add">
        <input
          className="finput"
          value={draft}
          placeholder={t("supply.addOwn")}
          onChange={(e) => setDraft(e.target.value)}
          // Enter añade, y NO envía el formulario: este control vive dentro de la ficha
          // del punto, y un Enter que guardara todo a media edición sería una sorpresa
          // cara.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOwn();
            }
          }}
        />
        <button type="button" className="sup-addbtn" onClick={addOwn} disabled={!draft.trim()}>
          {t("supply.add")}
        </button>
      </div>
    </div>
  );
}
