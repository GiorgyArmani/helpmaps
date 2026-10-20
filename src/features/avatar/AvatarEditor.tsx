"use client";

import { useState } from "react";
import {
  COLORS,
  HABITATS,
  ITEMS,
  itemDef,
  randomAvatar,
  type Avatar,
  type ColorId,
  type SpeciesId,
} from "@/domain/avatar";
import type { DictKey } from "@/i18n";
import { useI18n } from "@/i18n/context";
import { Icon } from "@/ui/icons";
import { AvatarScene } from "@/features/avatar/AvatarArt";
import { paint, tileSvg, type Mood } from "@/features/avatar/art";

/** Cuatro pestañas: caben en 390 px sin deslizarse. */
const TABS = ["especie", "habitat", "ropa", "accesorios"] as const;
type Tab = (typeof TABS)[number];
/** Dentro de «Accesorios», la zona del cuerpo. */
const ZONES = ["cabeza", "cara", "cuello", "cuerpo"] as const;
type Zone = (typeof ZONES)[number];
type WearSlot = "ropa" | Zone;

/**
 * El creador de avatar, como el de un juego para el teléfono. Lo usan el paso 1 de
 * `/registro` y «Tu avatar» en la cuenta.
 *
 * ── LA FORMA, PENSADA PARA UNA MANO ─────────────────────────────────────────
 *
 * Arriba la escena: el hábitat de borde a borde y el personaje parado en su suelo. Queda
 * FIJA mientras se baja por las opciones (`position: sticky`), así cada toque se ve puesto
 * sin tener que volver a subir. Debajo, un panel con cuatro pestañas —Especie, Hábitat,
 * Ropa, Accesorios— y una cuadrícula de fichas en la que cada ficha enseña TU personaje con
 * esa opción puesta. En Accesorios, una fila elige la zona: cabeza, cara, cuello o cuerpo.
 *
 * Las fichas no llevan paisaje: un fondo neutro y el personaje. Sólo en Hábitat el color es
 * la opción. Con veinte cuadros amarillos cada uno con su sombra, la pantalla se leía como
 * ruido y no como un menú.
 *
 * ── CONTROLADO ──────────────────────────────────────────────────────────────
 *
 * No guarda nada. Quien lo monta decide cuándo se guarda y le pasa el nivel real de la
 * persona para dibujar los candados. Ese nivel sólo decide qué se ENSEÑA abierto: lo que de
 * verdad se puede llevar lo vuelve a decidir el servidor al guardar (`parseAvatar`).
 */
export default function AvatarEditor({
  value,
  onChange,
  species,
  level,
  mood = "neutral",
}: {
  value: Avatar;
  onChange: (a: Avatar) => void;
  /** Las especies que ofrece este país (su preset). */
  species: readonly SpeciesId[];
  /** El nivel de la persona; 1 en el registro. */
  level: number;
  mood?: Mood;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("especie");
  const [zone, setZone] = useState<Zone>("cabeza");
  // Cada cambio vuelve a lanzar el saltito del personaje (ver `.ave-hop`).
  const [hop, setHop] = useState(0);

  const change = (a: Avatar) => {
    setHop((n) => n + 1);
    onChange(a);
  };

  const slot: WearSlot | null =
    tab === "ropa" ? "ropa" : tab === "accesorios" ? zone : null;
  const cur = slot ? value[slot] : undefined;
  const curDef = cur ? itemDef(cur.id) : undefined;

  function wear(s: WearSlot, id: string | null) {
    const next = { ...value };
    if (id === null) {
      if (s !== "ropa") delete next[s];
    } else {
      const def = itemDef(id)!;
      const prev = value[s];
      const keep = prev?.c && def.def ? prev.c : def.def;
      next[s] = keep ? { id, c: keep } : { id };
    }
    change(next);
  }

  // Las fichas de la pestaña abierta.
  type Tile = {
    key: string;
    label: string;
    on: boolean;
    preview: Avatar;
    lockLevel?: number;
    pick: () => void;
  };
  let tiles: Tile[] = [];
  if (tab === "especie") {
    tiles = species.map((sp) => ({
      key: sp,
      label: t(`avatar.sp.${sp}` as DictKey),
      on: sp === value.sp,
      preview: { ...value, sp },
      pick: () => change({ ...value, sp }),
    }));
  } else if (tab === "habitat") {
    tiles = HABITATS.map((h) => ({
      key: h,
      label: t(`avatar.hab.${h}` as DictKey),
      on: h === value.hab,
      preview: { ...value, hab: h },
      pick: () => change({ ...value, hab: h }),
    }));
  } else if (slot) {
    if (slot !== "ropa") {
      const without = { ...value };
      delete without[slot];
      tiles.push({
        key: "none",
        label: t("avatar.none"),
        on: !cur,
        preview: without,
        pick: () => wear(slot, null),
      });
    }
    for (const it of ITEMS.filter((i) => i.slot === slot)) {
      const c = it.def ? (value[slot]?.c ?? it.def) : undefined;
      tiles.push({
        key: it.id,
        label: t(`avatar.item.${it.id}` as DictKey),
        on: cur?.id === it.id,
        preview: { ...value, [slot]: c ? { id: it.id, c } : { id: it.id } },
        lockLevel: it.lock && it.lock > level ? it.lock : undefined,
        pick: () => wear(slot, it.id),
      });
    }
  }
  const view = tab === "accesorios" ? zone : tab;

  return (
    <div className="ave">
      <div className="ave-scene">
        <div
          key={hop}
          className={hop ? "ave-scene-in ave-hop" : "ave-scene-in"}
        >
          <AvatarScene avatar={value} mood={mood} />
        </div>
        <span className="ave-tag" aria-hidden="true">
          {t(`avatar.sp.${value.sp}` as DictKey)}
        </span>
        <button
          type="button"
          className="ave-dice"
          onClick={() => change(randomAvatar(species, level))}
        >
          <Icon.spark width={16} height={16} />
          {t("avatar.surprise")}
        </button>
      </div>

      <div className="ave-sheet">
        {/* Las pestañas quedan fijas justo debajo de la escena: se cambia de categoría sin
            volver a subir. */}
        <div className="ave-bar">
          <div
            className="ave-tabs"
            role="tablist"
            aria-label={t("avatar.title")}
          >
            {TABS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={k === tab}
                className={k === tab ? "ave-tab ave-tab-on" : "ave-tab"}
                onClick={() => setTab(k)}
              >
                {t(`avatar.tab.${k}` as DictKey)}
              </button>
            ))}
          </div>

          {tab === "accesorios" ? (
            <div
              className="ave-zones"
              role="radiogroup"
              aria-label={t("avatar.tab.accesorios")}
            >
              {ZONES.map((z) => {
                const worn = Boolean(value[z]);
                return (
                  <button
                    key={z}
                    type="button"
                    role="radio"
                    aria-checked={z === zone}
                    className={z === zone ? "ave-zone ave-zone-on" : "ave-zone"}
                    onClick={() => setZone(z)}
                  >
                    {t(`avatar.slot.${z}` as DictKey)}
                    {/* Un punto donde ya hay algo puesto: se ve qué zonas están vestidas. */}
                    {worn ? (
                      <span className="ave-zone-dot" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div
          className="ave-grid"
          role="radiogroup"
          aria-label={t(`avatar.tab.${tab}` as DictKey)}
        >
          {tiles.map((x) => {
            const art = (
              <span
                className="ave-tile-art"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: tileSvg(x.preview, view) }}
              />
            );
            if (x.lockLevel) {
              const lvl = t(`level.${x.lockLevel}` as DictKey);
              return (
                <button
                  key={x.key}
                  type="button"
                  className="ave-tile ave-tile-locked"
                  aria-disabled="true"
                  aria-label={`${x.label}. ${t("avatar.lockedAt", { level: lvl })}`}
                  title={t("avatar.lockedAt", { level: lvl })}
                >
                  {art}
                  <span className="ave-tile-lock" aria-hidden="true">
                    <Icon.lock width={11} height={11} />
                    {lvl}
                  </span>
                  <span className="ave-tile-n">{x.label}</span>
                </button>
              );
            }
            return (
              <button
                key={x.key}
                type="button"
                role="radio"
                aria-checked={x.on}
                className={x.on ? "ave-tile ave-on" : "ave-tile"}
                onClick={x.pick}
              >
                {art}
                {x.on ? (
                  <span className="ave-tile-check" aria-hidden="true">
                    <Icon.check width={12} height={12} />
                  </span>
                ) : null}
                <span className="ave-tile-n">{x.label}</span>
              </button>
            );
          })}
        </div>

        {slot && cur && curDef?.def ? (
          <div className="ave-colors">
            <span className="ave-lbl">{t("avatar.color")}</span>
            <div
              className="ave-dots"
              role="radiogroup"
              aria-label={t("avatar.color")}
            >
              {COLORS.map((c: ColorId) => {
                const on = (cur.c ?? curDef.def) === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={t(`avatar.color.${c}` as DictKey)}
                    title={t(`avatar.color.${c}` as DictKey)}
                    className={on ? "ave-dot ave-on" : "ave-dot"}
                    style={{ background: paint(c) }}
                    onClick={() => change({ ...value, [slot]: { ...cur, c } })}
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        {tab === "habitat" ? (
          <p className="ave-hint">{t("avatar.habitatHint")}</p>
        ) : null}
        {tiles.some((x) => x.lockLevel) ? (
          <p className="ave-hint">{t("avatar.specialsHint")}</p>
        ) : null}
      </div>
    </div>
  );
}
