"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Notice, Spinner } from "@/ui/primitives";
import LoginForm from "@/features/admin/LoginForm";
import { useStaffSession } from "@/features/admin/useStaffSession";
import {
  fetchEmergencies,
  fetchEmergencyPointCounts,
  saveEmergency,
  type EmergencyDraft,
} from "@/data/emergencies";
import EmergencyForm, { blankEmergency } from "@/features/registry/EmergencyForm";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import type { EmergencyRow } from "@/config/fromRow";

/**
 * The registry console.
 *
 * ── WHAT IT ADMINISTERS, AND WHAT IT DELIBERATELY CANNOT ────────────────────
 *
 * Configuration. Names, viewports, affected regions, the legal notice, which modules a
 * country offers. Not points, not suggestions, not people — those live in each country's
 * own database, under its own controller, and there is no connection here for a role to
 * travel over. That separation is the reason the network can be administered from one
 * place at all without collecting everyone's data in one place.
 *
 * ── WHY IT RUNS ON A COUNTRY DEPLOYMENT TOO ─────────────────────────────────
 *
 * On the hub this lists the whole network. On a country deployment it lists that country's
 * own row, normally one — and that is the case that pays for itself day to day: adding an
 * affected region in the first week of an emergency stops being a commit, a review and a
 * deploy, and becomes an edit.
 */
export default function RegistryConsole() {
  const { session, checked, refresh } = useStaffSession(true);
  const [rows, setRows] = useState<EmergencyRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<EmergencyDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canWrite = session?.role === "superadmin";

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const [list, pointCounts] = await Promise.all([
        fetchEmergencies(sb),
        fetchEmergencyPointCounts(sb),
      ]);
      setRows(list);
      setCounts(pointCounts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "no se pudo leer el registro");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
    void load();
  }, [session, load]);

  const grouped = useMemo(() => {
    const order: EmergencyRow["status"][] = ["active", "draft", "archived"];
    return order
      .map((status) => ({ status, items: (rows ?? []).filter((r) => r.status === status) }))
      .filter((g) => g.items.length > 0);
  }, [rows]);

  async function handleSave() {
    if (!draft) return;
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    try {
      await saveEmergency(sb, draft);
      setSaved(draft.name);
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "no se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  if (!supabaseConfigured()) {
    return (
      <Notice tone="warn">
        Este despliegue todavía no tiene base de datos configurada, así que no hay registro
        que administrar.
      </Notice>
    );
  }

  if (!checked) return <Spinner />;

  if (!session) {
    return (
      <div className="regauth">
        <p className="regintro">Entrá con tu cuenta del equipo para ver el registro.</p>
        <LoginForm onSignedIn={refresh} />
      </div>
    );
  }

  if (draft) {
    return (
      <div className="regwrap">
        <h2 className="reghead">{draft.id ? "Editar emergencia" : "Nueva emergencia"}</h2>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <EmergencyForm
          // Remonta el formulario al cambiar de emergencia, para que los bloques JSON se
          // resiembren desde la fila nueva en vez de sincronizarse en un efecto.
          key={draft.id ?? "nueva"}
          draft={draft}
          onChange={setDraft}
          onSave={handleSave}
          onCancel={() => setDraft(null)}
          busy={busy}
          canWrite={canWrite}
        />
      </div>
    );
  }

  return (
    <div className="regwrap">
      <div className="reghead-row">
        <h2 className="reghead">Emergencias</h2>
        {canWrite ? (
          <Button onClick={() => setDraft(blankEmergency())}>Nueva</Button>
        ) : null}
      </div>

      {!canWrite ? (
        <Notice tone="info">
          Estás viendo el registro en modo lectura. Cambiarlo requiere el rol de superadmin.
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {saved ? <Notice tone="info">Guardado: {saved}</Notice> : null}

      {rows === null ? <Spinner /> : null}

      {rows !== null && rows.length === 0 ? (
        <Notice tone="info">
          No hay ninguna emergencia todavía. Mientras la tabla esté vacía, el despliegue sirve
          la configuración compilada en <code>config/presets/</code> — que es exactamente como
          se comportaba antes de existir este registro.
        </Notice>
      ) : null}

      {grouped.map((group) => (
        <section key={group.status} className="reggroup">
          <h3 className="reggroup-h">{statusLabel(group.status)}</h3>
          <ul className="reglist">
            {group.items.map((row) => (
              <li key={row.id} className="regrow">
                <div className="regrow-main">
                  <span className="regname">{row.name}</span>
                  <span className="regmeta">
                    {row.country_name} · <code>{row.slug}</code>
                    {row.host ? (
                      <>
                        {" · "}
                        <code>{row.host}</code>
                      </>
                    ) : (
                      " · sin dominio"
                    )}
                  </span>
                </div>
                <div className="regrow-side">
                  {row.maintenance ? <Badge tone="warn">mantenimiento</Badge> : null}
                  <span className="regcount">{counts[row.id] ?? 0} puntos</span>
                  <Button variant="ghost" onClick={() => setDraft({ ...row })}>
                    {canWrite ? "Editar" : "Ver"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function statusLabel(status: EmergencyRow["status"]): string {
  if (status === "active") return "Activas";
  if (status === "draft") return "Borradores";
  return "Archivadas";
}
