"use client";

import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";

export type PanelTab = "feed" | "nearby" | "points" | "digital";

/**
 * The three tabs at the top of the points panel: what is around you, places you can go
 * to, and initiatives that help without a seat. Same visual language as the staff
 * panel's `admtabs` — one row of pills, the active one filled — so it reads as part of
 * the same product.
 *
 * A tab and not a sixth type chip: the chips grid is five equal columns on purpose, and
 * neither a digital initiative nor a distance is a kind of place to filter among places.
 *
 * ── EL NOMBRE, SÓLO EN LA QUE ESTÁ ABIERTA ─────────────────────────────────
 *
 * Cuatro nombres a la vez no caben en un teléfono de 390px: «Puntos» perdía cuatro letras
 * en una elipsis por un desajuste de medio píxel, y cada idioma y cada contador estaban a
 * una palabra de volver a romperlo. De ahí salió dejarlo todo en iconos.
 *
 * Pero cuatro iconos sin una sola palabra tampoco se entienden — una campana y una diana
 * no dicen «lo que pasa cerca» y «a dónde voy» a quien abre esto por primera vez, y el
 * hallazgo de una función no puede depender de mantener el dedo encima para ver un título
 * que en un móvil no existe.
 *
 * La salida es que la pestaña ABIERTA se ensancha y enseña su nombre, y las otras tres se
 * quedan en su icono. Sólo hay un nombre en pantalla, así que cabe siempre, en cualquier
 * idioma; y la que está abierta se distingue por el ancho y por la palabra, no sólo por el
 * color — que es lo que pide no fiarlo todo al color. El nombre sigue en `aria-label` para
 * quien navega con lector de pantalla.
 *
 * "Cerca" goes FIRST because it answers the question people actually open this with on
 * the street. Its pill carries no count until there is a location: a zero there would
 * read as "there is nothing near you" when what it means is "nobody has asked yet".
 *
 * `data-tour="paneltabs"` is an optional anchor: a deck without that step simply skips
 * it.
 */
export default function PanelTabs({
  tab,
  counts,
  onChange,
}: {
  tab: PanelTab;
  counts: { feed: number | null; nearby: number | null; points: number; digital: number };
  onChange: (next: PanelTab) => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="ptabs" data-tour="paneltabs">
      {/* El feed va PRIMERO: es «qué está pasando», la pregunta con la que se abre una
          aplicación por costumbre. Las otras tres son «a dónde voy», que se consultan
          cuando ya hace falta algo concreto. */}
      <TabButton
        on={tab === "feed"}
        label={t("feed.title")}
        count={counts.feed}
        icon={<Icon.bell />}
        onClick={() => onChange("feed")}
      />
      <TabButton
        on={tab === "nearby"}
        label={t("panel.tab.nearby")}
        count={counts.nearby}
        icon={<Icon.target />}
        onClick={() => onChange("nearby")}
      />
      <TabButton
        on={tab === "points"}
        label={t("map.points")}
        count={counts.points}
        icon={<Icon.directions />}
        onClick={() => onChange("points")}
      />
      <TabButton
        on={tab === "digital"}
        label={t("panel.tab.digital")}
        count={counts.digital}
        icon={<Icon.globe />}
        onClick={() => onChange("digital")}
      />
    </nav>
  );
}

function TabButton({
  on,
  label,
  count,
  icon,
  onClick,
}: {
  on: boolean;
  label: string;
  /** `null` hides the pill: see the note above about a count nobody has asked for. */
  count: number | null;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ptab${on ? " ptab-on" : ""}`}
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      aria-label={label}
      title={label}
    >
      <span className="ptab-ic">{icon}</span>
      {/* Se pinta siempre y lo esconde el CSS en las que no están abiertas: así la
          anchura se anima entre un estado y otro en vez de dar un salto, y el texto no
          entra y sale del árbol en cada toque. `aria-hidden` porque el nombre ya lo da
          `aria-label` y de otro modo un lector de pantalla lo diría dos veces. */}
      <span className="ptab-lb" aria-hidden="true">
        {label}
      </span>
      {count === null ? null : <span className="ptab-n">{count}</span>}
    </button>
  );
}
