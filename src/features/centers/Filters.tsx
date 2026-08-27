"use client";

import type { Center } from "@/domain/types";
import type { CenterFilter } from "@/domain/center";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import CenterPicker from "@/features/centers/CenterPicker";
import RegionPicker from "@/features/centers/RegionPicker";

/**
 * Search and the two dropdowns, as one segment of the unified bar.
 *
 * The three used to be three stacked rows floating over the map. On a phone that is still
 * the right shape and it is what the team tuned; on a wide screen it was three bands of
 * chrome eating the top third of the map before showing a single pin. Here they are one
 * segment that sits in the bar next to the brand and the actions.
 *
 * The region list comes from `useSite()` and not from the compiled preset: on a deployment
 * that resolves its emergency from a row, the affected regions are whatever that row says
 * — which is the whole reason a superadmin can add one without a deploy.
 *
 * `data-tour` ids are anchors for the guided tour. Don't rename them.
 */
export default function Filters({
  filter,
  onChange,
  centers,
  selectedId,
  onPickCenter,
}: {
  filter: CenterFilter;
  onChange: (next: CenterFilter) => void;
  centers: Center[];
  selectedId: string | null;
  onPickCenter: (id: string | null) => void;
}) {
  const { t } = useI18n();

  return (
    // Un solo control, no tres.
    //
    // El buscador y los dos selectores eran tres cajas sueltas puestas una al lado de la
    // otra: se leían como tres decisiones distintas cuando en realidad son la misma —
    // acotar qué se ve en el mapa. Acá son segmentos de un mismo campo, separados por un
    // filo, como la barra de una aplicación de escritorio.
    <div className="searchbar" data-tour="search">
      <Icon.search className="si" />
      <input
        className="sinput"
        type="search"
        inputMode="search"
        value={filter.query}
        placeholder={t("map.searchPlaceholder")}
        aria-label={t("common.search")}
        onChange={(e) => onChange({ ...filter, query: e.target.value })}
      />
      {filter.query ? (
        <button
          type="button"
          className="sx"
          aria-label={t("common.close")}
          onClick={() => onChange({ ...filter, query: "" })}
        >
          ✕
        </button>
      ) : null}

      <span className="sbdiv" aria-hidden="true" />

      <RegionPicker
        value={filter.region}
        onPick={(code) => onChange({ ...filter, region: code })}
      />

      <span className="sbdiv" aria-hidden="true" />

      <CenterPicker centers={centers} valueId={selectedId} onPick={onPickCenter} />
    </div>
  );
}
