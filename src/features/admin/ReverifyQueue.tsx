"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/context";
import { Icon } from "@/ui/icons";
import { Notice } from "@/ui/primitives";
import type { Center } from "@/domain/types";
import { daysSince, lastTouched } from "@/domain/center";
import { verifiedAgo, verifyDaysLeft, verifyState } from "@/domain/verification";
import { useSite, useSiteHelpers } from "@/features/app/SiteProvider";
import { getSupabase } from "@/lib/supabase/client";
import { reverifyLocation } from "@/data/adminMetrics";
import type { DictKey } from "@/i18n";

/**
 * La cola de re-verificación: lo que hay que volver a comprobar, lo más urgente arriba.
 *
 * Dos cosas distintas en una sola lista, separadas por un conmutador:
 *
 * - **Organizaciones**: las que tienen gestor y cuyo sello vence o venció (90 días). Un
 *   sello vencido no se ve en público; el trabajo del equipo es renovarlo llamando a la
 *   organización, no esconderlo.
 * - **Puntos**: cualquier punto activo cuyo dato lleva más de `staleAfterDays` sin que nadie
 *   lo confirme. Es lo que el mapa ya marca como «sin confirmar».
 *
 * «Verificado hoy» es un toque: lo que hace un voluntario después de una ronda de llamadas.
 * Lo resuelve la base (`reverify_location`), que comprueba que quien toca alcanza ese punto.
 */

type Mode = "orgs" | "points";

export default function ReverifyQueue({
  centers,
  onVerified,
  onEdit,
}: {
  centers: Center[];
  /** La fila quedó verificada: la carcasa actualiza su copia sin recargar todo. */
  onVerified: (id: string, at: string, managed: boolean) => void;
  onEdit: (c: Center) => void;
}) {
  const { t } = useI18n();
  const site = useSite();
  const helpers = useSiteHelpers();
  const staleDays = site.map.staleAfterDays;
  const [mode, setMode] = useState<Mode>("orgs");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const orgs = useMemo(
    () =>
      centers
        .filter((c) => c.active && c.info?.verified_at && verifyState(c.info.verified_at) !== "verified")
        .sort((a, b) => (a.info!.verified_at ?? "").localeCompare(b.info!.verified_at ?? "")),
    [centers],
  );

  const points = useMemo(
    () =>
      centers
        .filter((c) => {
          if (!c.active) return false;
          const d = daysSince(lastTouched(c));
          return d === null || d >= staleDays;
        })
        .sort((a, b) => (lastTouched(a) ?? "").localeCompare(lastTouched(b) ?? "")),
    [centers, staleDays],
  );

  const list = mode === "orgs" ? orgs : points;

  async function verify(c: Center) {
    const sb = getSupabase();
    if (!sb || busy) return;
    setBusy(c.id);
    setErr(null);
    try {
      const at = await reverifyLocation(sb, c.id);
      onVerified(c.id, at, Boolean(c.info?.verified_at));
    } catch (e) {
      const missing = (e as { missing?: boolean }).missing;
      setErr(missing ? t("metrics.missing") : t("admin.saveError"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <div className="seg" role="group" aria-label={t("verify.queue")}>
        {(["orgs", "points"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`segb${mode === m ? " segb-on" : ""}`}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {t(m === "orgs" ? "verify.orgs" : "verify.points", { n: m === "orgs" ? orgs.length : points.length })}
          </button>
        ))}
      </div>

      <p className="fhint">
        {mode === "orgs" ? t("verify.orgsHint") : t("verify.pointsHint", { d: staleDays })}
      </p>
      {err ? <Notice tone="danger">{err}</Notice> : null}
      {list.length === 0 ? <p className="mut">{t("verify.empty")}</p> : null}

      {list.slice(0, 60).map((c) => {
        const ago = mode === "orgs" ? verifiedAgo(c.info?.verified_at) : daysSince(lastTouched(c));
        const left = verifyDaysLeft(c.info?.verified_at);
        const expired = mode === "orgs" ? verifyState(c.info?.verified_at) === "expired" : true;
        return (
          <div key={c.id} className="arow">
            <div className="ai">
              <div className="aname">{c.name}</div>
              <div className="asub">
                {c.region ? helpers.regionLabel(c.region) : t(`type.${c.type}` as DictKey)}
              </div>
              {/* La antigüedad en su propia línea: detrás de la región se cortaba con «…»
                  justo en el dato que ordena esta cola. */}
              <div className={expired ? "age age-late" : "age age-warn"}>
                {mode === "orgs"
                  ? expired
                    ? t("verify.expiredAgo", { n: ago ?? 0 })
                    : t("verify.expiresIn", { n: left ?? 0 })
                  : ago === null
                    ? t("center.neverConfirmed")
                    : t("verify.staleAgo", { n: ago })}
              </div>
            </div>
            <div className="aacts">
              <button
                type="button"
                className="amini"
                aria-label={t("common.edit")}
                title={t("common.edit")}
                onClick={() => onEdit(c)}
              >
                <Icon.pencil />
              </button>
              <button
                type="button"
                className="btnp verify-btn"
                disabled={busy !== null}
                onClick={() => void verify(c)}
              >
                <Icon.verified />
                {busy === c.id ? t("common.saving") : t("verify.today")}
              </button>
            </div>
          </div>
        );
      })}
      {list.length > 60 ? <p className="mut small">{t("verify.more", { n: list.length - 60 })}</p> : null}
    </div>
  );
}
