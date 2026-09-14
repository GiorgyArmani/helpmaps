"use client";

import type { CenterFilter } from "@/domain/center";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import RegionPicker from "@/features/centers/RegionPicker";

/**
 * Search and the region dropdown, as one segment of the unified bar.
 *
 * The three used to be three stacked rows floating over the map. On a phone that is still
 * the right shape and it is what the team tuned; on a wide screen it was three bands of
 * chrome eating the top third of the map before showing a single pin. Here they are one
 * segment that sits in the bar next to the brand and the actions.
 *
 * ── POR QUÉ YA NO ESTÁ «TODOS LOS PUNTOS» ───────────────────────────────────
 *
 * Había un tercer segmento, un selector con buscador interno que listaba los puntos por
 * tipo. Hacía lo mismo que el campo de al lado —buscar un punto por su nombre— con otro
 * gesto, en otro sitio y con otra caja de texto; y al abrir una ficha su rótulo pasaba a
 * decir el nombre del punto, así que parecía un filtro que se había quedado puesto. El
 * campo de búsqueda ya encuentra el punto y lo deja en la lista, a un toque de su ficha.
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
}: {
  filter: CenterFilter;
  onChange: (next: CenterFilter) => void;
}) {
  const { t } = useI18n();

  return (
    // Un solo control, no dos: el buscador y la región son segmentos de un mismo campo,
    // separados por un filo, como la barra de una aplicación de escritorio.
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
    </div>
  );
}
