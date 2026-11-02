"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Center } from "@/domain/types";
import { ensureOfficialLocation, fetchCenterById, fetchOfficialLocation } from "@/data/centers";
import { getSupabase } from "@/lib/supabase/client";
import { BRAND } from "@/config";
import { Notice } from "@/ui/primitives";
import { Icon } from "@/ui/icons";
import { PanelSkeleton } from "@/ui/Skeleton";
import { useI18n } from "@/i18n/context";
import InitiativePanel from "@/features/initiative/InitiativePanel";

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "none" }
  | { kind: "ready"; center: Center };

/**
 * «HelpMaps»: el equipo publica con la voz de la plataforma.
 *
 * El perfil oficial es un punto más (`db/21_helpmaps_oficial.sql`), así que aquí no hay
 * formularios propios: es el MISMO editor que usa cualquier iniciativa, abierto sobre ese
 * punto. Publicaciones, campañas y eventos salen por el camino de siempre, y el feed los
 * pone arriba para todo el país durante una semana (`OFFICIAL_PIN_DAYS`).
 *
 * Sólo admin: lo que se publica aquí lo ve todo el mundo antes que nada, y crearlo lo
 * comprueba además la base.
 */
export default function OfficialPanel() {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void (async () => {
      const found = await fetchOfficialLocation(sb);
      if (!vivo) return;
      if (found.missing) return setState({ kind: "missing" });
      if (!found.id) return setState({ kind: "none" });
      const center = await fetchCenterById(sb, found.id);
      if (!vivo) return;
      setState(center ? { kind: "ready", center } : { kind: "none" });
    })();
    return () => {
      vivo = false;
    };
  }, [vuelta]);

  async function create() {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    try {
      await ensureOfficialLocation(sb, BRAND.name);
      recargar();
    } catch {
      setError(t("official.createError"));
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "loading") return <PanelSkeleton />;

  if (state.kind === "missing") {
    return <Notice tone="warn">{t("official.missing")}</Notice>;
  }

  if (state.kind === "none") {
    return (
      <div className="stack">
        <p className="official-lead">{t("official.lead")}</p>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <button type="button" className="btnp" onClick={() => void create()} disabled={busy}>
          <Icon.plus />
          {busy ? t("common.saving") : t("official.create", { name: BRAND.name })}
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="official-lead">{t("official.lead")}</p>
      <Link className="btng official-view" href={`/c/${state.center.id}`}>
        <Icon.eye />
        {t("official.view")}
      </Link>
      <InitiativePanel center={state.center} onClose={recargar} platform />
    </div>
  );
}
