"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Center, LocationType } from "@/domain/types";
import { normalize } from "@/domain/center";
import { enabledTypes, typeStyle } from "@/config";
import { Icon, TypeGlyph } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";

/**
 * The "all points" picker — ported from the original app, which replaced a native
 * `<select>` here for a concrete reason: the list runs to hundreds of entries across
 * several types, and a flat native dropdown of that length is unusable on a phone. This
 * one has a search box and groups by type, and looks the same on both.
 */
export default function CenterPicker({
  centers,
  valueId,
  onPick,
}: {
  centers: Center[];
  valueId: string | null;
  onPick: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = valueId ? centers.find((c) => c.id === valueId) : null;

  const groups = useMemo(() => {
    const nq = normalize(q.trim());
    const byType = new Map<LocationType, Center[]>();
    for (const c of centers) {
      if (nq && !normalize(c.name).includes(nq)) continue;
      const list = byType.get(c.type);
      if (list) list.push(c);
      else byType.set(c.type, [c]);
    }
    return enabledTypes()
      .map((type) => ({ type, items: byType.get(type) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [centers, q]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: string | null) {
    onPick(id);
    setOpen(false);
    setQ("");
  }

  return (
    <div className={`cpick${open ? " cpick-open" : ""}`} ref={rootRef}>
      <button type="button" className="cpick-btn" onClick={() => setOpen((o) => !o)}>
        <Icon.directions />
        <span className="cpick-val">{selected?.name ?? t("map.allCenters")}</span>
        <svg
          className="cpick-chev"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="cpick-panel">
          <div className="cpick-search">
            <Icon.search />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("map.centerSearch")}
              aria-label={t("map.centerSearch")}
            />
            {q ? (
              <button
                type="button"
                className="cpick-x"
                onClick={() => setQ("")}
                aria-label={t("common.close")}
              >
                ✕
              </button>
            ) : null}
          </div>

          <div className="cpick-list">
            <button
              type="button"
              className={`cpick-opt cpick-all${!valueId ? " cpick-sel" : ""}`}
              onClick={() => pick(null)}
            >
              {t("map.allCenters")}
            </button>

            {groups.map((g) => (
              <div key={g.type}>
                <div className="cpick-ghead">
                  <span className="cpick-gico" style={{ color: typeStyle(g.type).color }}>
                    <TypeGlyph name={typeStyle(g.type).icon} size={14} />
                  </span>
                  {t(`type.${g.type}.plural` as DictKey)}
                </div>
                {g.items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`cpick-opt${valueId === c.id ? " cpick-sel" : ""}`}
                    onClick={() => pick(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            ))}

            {groups.length === 0 ? <div className="cpick-empty">{t("map.noResults")}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
