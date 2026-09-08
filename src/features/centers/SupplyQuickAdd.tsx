"use client";

import { RECEIVES_PRESETS, normalizeSupply } from "@/domain/needs";
import { useI18n } from "@/i18n/context";

/**
 * Los mismos insumos de `SupplyPicker`, pero para un campo de TEXTO.
 *
 * ── POR QUÉ NO ES EL MISMO COMPONENTE ───────────────────────────────────────
 *
 * «Qué recibe» es un array (`center_info.receives`) y «qué necesita ahora» es una frase
 * (`center_info.needs`). Son distintos a propósito y llevan años siéndolo: lo que un punto
 * recibe es una lista cerrada de categorías, y lo que necesita HOY se escribe en cristiano
 * —«medicinas para hipertensión, pañales talla 3»— porque el matiz es justo lo que hace
 * útil ese campo.
 *
 * Convertir `needs` en un array para poder reusar el selector habría obligado a migrar
 * cientos de frases escritas a mano a lo largo de meses, y habría perdido ese matiz. Así
 * que este componente no sustituye al campo: lo alimenta. Tocar un chip AÑADE la palabra
 * al final del texto, y a partir de ahí se sigue escribiendo con normalidad.
 *
 * El ahorro es el mismo que en el otro —no teclear «medicamentos» desde cero— sin cambiar
 * el modelo ni pedirle a nadie que rellene un formulario distinto al que ya conocía.
 */
export default function SupplyQuickAdd({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useI18n();

  /** ¿Ya está nombrado en el texto? Evita ofrecer añadir dos veces lo mismo. */
  const has = (label: string) => normalizeSupply(value).includes(normalizeSupply(label));

  function add(label: string) {
    const limpio = value.trim();
    // Coma y espacio si ya había algo. Sin punto final: esto se sigue escribiendo.
    onChange(limpio ? `${limpio.replace(/[,\s]+$/, "")}, ${label.toLowerCase()}` : label);
  }

  return (
    <div className="supq">
      <span className="fhint">{t("supply.quickHint")}</span>
      <div className="supq-chips">
        {RECEIVES_PRESETS.map((key) => {
          const label = t(key);
          if (has(label)) return null;
          return (
            <button key={key} type="button" className="supq-chip" onClick={() => add(label)}>
              +&nbsp;{label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
