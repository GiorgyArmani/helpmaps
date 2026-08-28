"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuditEntry, Center, Donation, StaffSession, Submission } from "@/domain/types";
import { isAdminRole } from "@/domain/types";
import {
  deleteCenter,
  fetchAllCenters,
  saveCenter,
  closeCenter,
  confirmCenterOpen,
  type CenterDraft,
} from "@/data/centers";
import {
  fetchAudit,
  fetchSettings,
  fetchSubmissions,
  fetchVolunteerRequests,
  reviewSubmission,
  setMaintenance,
  type VolunteerRequest,
} from "@/data/staff";
import {
  deleteDonation,
  fetchAllDonations,
  saveDonation,
  type DonationDraft,
} from "@/data/donations";
import { getSupabase } from "@/lib/supabase/client";
import { useEmergencyId } from "@/features/app/SiteProvider";
import { Badge, Notice } from "@/ui/primitives";
import { Icon } from "@/ui/icons";
import { useI18n, useTimeAgo } from "@/i18n/context";
import { fetchPendingReports, resolveReports, type ReportGroup } from "@/data/account";
import CenterForm from "@/features/admin/CenterForm";
import DonationForm from "@/features/admin/DonationForm";
import type { DictKey } from "@/i18n";
import { useSite, useSiteHelpers } from "@/features/app/SiteProvider";

type Tab = "activity" | "centers" | "submissions" | "reports" | "volunteers" | "donations";

/**
 * The team panel.
 *
 * Trust model, inherited from running this for real: volunteers publish LIVE, with no
 * review queue in front of them. What holds the line is that access is revocable and
 * every write is recorded by a database trigger nobody can forget to call. Deleting
 * stays admin-only, because a deleted point is indistinguishable from a closed one to
 * the family that was looking for it.
 *
 * The controls here are the ported ones on purpose: a dashed `.addbtn` for "new", square
 * `.amini` icon actions in a row, `.subcard` for something under review, a real `.switch`
 * for maintenance. They read as the same product as the public side.
 */
export default function AdminPanel({
  session,
  onPinDrag,
  onDraftPin,
  onPendingChange,
}: {
  session: StaffSession;
  /** Slot the map's pin-drag writes through, straight into the open form. */
  onPinDrag: React.MutableRefObject<((at: { lat: number; lng: number }) => void) | null>;
  /** Publishes the edited point's coordinates so the map can draw them. */
  onDraftPin: (at: { lat: number; lng: number } | null) => void;
  /**
   * How many items are waiting on someone. The header's staff button wears this as a
   * badge, so a volunteer who closed the panel still sees that something arrived.
   */
  onPendingChange?: (n: number) => void;
}) {
  const site = useSite();
  const helpers = useSiteHelpers();
  const { t } = useI18n();
  const ago = useTimeAgo();
  const isAdmin = isAdminRole(session.role);

  const [tab, setTab] = useState<Tab>("activity");
  const [centers, setCenters] = useState<Center[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerRequest[]>([]);
  const [reports, setReports] = useState<ReportGroup[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [creatingDonation, setCreatingDonation] = useState(false);
  const [maintenance, setMaintenanceState] = useState(false);
  const [editing, setEditing] = useState<Center | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // La emergencia que se está administrando. En un despliegue que todavía no adoptó la
  // tabla es null, y entonces el panel se comporta como siempre: una sola emergencia
  // implícita, sin filtro y sin sello.
  const emergencyId = useEmergencyId();

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const [c, sub, vol, log, settings, don, rep] = await Promise.all([
        fetchAllCenters(sb, emergencyId),
        fetchSubmissions(sb),
        isAdmin ? fetchVolunteerRequests(sb) : Promise.resolve([]),
        fetchAudit(sb),
        fetchSettings(sb),
        site.features.donations ? fetchAllDonations(sb) : Promise.resolve([]),
        // Los avisos los ve TODO el equipo, no sólo los admins: un voluntario que sale a
        // comprobar puntos es justo quien mejor puede resolverlos.
        fetchPendingReports(sb),
      ]);
      setCenters(c);
      setSubmissions(sub);
      setVolunteers(vol);
      setReports(rep);
      setAudit(log);
      setDonations(don);
      setMaintenanceState(settings.maintenance);
      onPendingChange?.(sub.length + vol.length + rep.length);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
    }
  }, [isAdmin, onPendingChange, emergencyId]);

  useEffect(() => {
    // Fetch on mount. Every setState inside `load` happens after an await, so this
    // cannot cascade renders the way the rule is guarding against.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return centers;
    return centers.filter((c) => c.name.toLowerCase().includes(q));
  }, [centers, query]);

  async function handleSave(draft: CenterDraft, statusChanged: boolean) {
    const sb = getSupabase();
    if (!sb) return;
    await saveCenter(sb, draft, { statusChanged, emergencyId });
    setEditing(null);
    setCreating(false);
    await load();
  }

  async function handleDelete(center: Center) {
    const sb = getSupabase();
    if (!sb) return;
    if (!window.confirm(t("admin.deleteConfirm", { name: center.name }))) return;
    setBusy(true);
    try {
      await deleteCenter(sb, center.id);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleMaintenance() {
    const sb = getSupabase();
    if (!sb) return;
    const next = !maintenance;
    setMaintenanceState(next); // optimistic: the switch has to feel instant
    try {
      await setMaintenance(sb, next);
    } catch {
      setMaintenanceState(!next);
      setError(t("admin.saveError"));
    }
  }

  async function review(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.saveError"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Approving a volunteer creates their account, grants the role and emails them the
   * welcome with the manual — all of it server-side, because creating an auth user needs
   * the service role (`/api/staff/volunteers`).
   *
   * The response is not just ok/failed: when the welcome email does not go out it comes
   * back with the single-use set-password LINK, shown here so the admin can pass it on
   * another way. An approved volunteer who never gets in is the same as a rejected one,
   * except nobody notices. No password is generated or displayed any more — the link is
   * what travels, and it expires.
   */
  async function reviewVolunteer(id: string, action: "approve" | "reject") {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/staff/volunteers", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data: { emailed?: boolean; setPasswordUrl?: string; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok && res.status !== 207) {
        setError(data.error ?? t("admin.saveError"));
        return;
      }
      if (action === "reject") setNotice(t("admin.volRejected"));
      else if (data.emailed) setNotice(t("admin.volApproved"));
      else setNotice(t("admin.volApprovedNoMail", { p: data.setPasswordUrl ?? "—" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.saveError"));
    } finally {
      setBusy(false);
    }
  }

  if (creatingDonation || editingDonation) {
    return (
      <div className="admwrap-body">
        <div className="wrapline">
          <h1>{editingDonation ? editingDonation.name : t("admin.newDonation")}</h1>
        </div>
        <DonationForm
          donation={editingDonation}
          canDelete={isAdmin}
          onSave={async (draft: DonationDraft) => {
            await review(async () => {
              const sb = getSupabase();
              if (sb) await saveDonation(sb, draft);
            });
            setEditingDonation(null);
            setCreatingDonation(false);
          }}
          onCancel={() => {
            setEditingDonation(null);
            setCreatingDonation(false);
          }}
          onDelete={
            editingDonation
              ? () => {
                  if (!window.confirm(t("admin.deleteConfirm"))) return;
                  void review(async () => {
                    const sb = getSupabase();
                    if (sb) await deleteDonation(sb, editingDonation.id);
                  }).then(() => {
                    setEditingDonation(null);
                    setCreatingDonation(false);
                  });
                }
              : undefined
          }
        />
      </div>
    );
  }

  if (creating || editing) {
    return (
      <div className="admwrap-body">
        <div className="wrapline">
          <h1>{editing ? editing.name : t("admin.newCenter")}</h1>
        </div>
        <CenterForm
          center={editing}
          canDelete={isAdmin}
          onPinDrag={onPinDrag}
          onCoordsChange={onDraftPin}
          onSave={handleSave}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
          onDelete={editing ? () => void handleDelete(editing) : undefined}
        />
      </div>
    );
  }

  const pendingTotal = submissions.length + volunteers.length;

  return (
    <div className="admwrap-body">
      {/* Icon rail, as in the original, and FIRST — flush under the overlay header, so
          the header and the rail read as one control strip the way they do there.
          The words were the port's idea and they cost more than they explained: five
          labelled pills do not fit a 430px column, so the row wrapped to two lines and
          pushed the feed below the fold on a phone. Icons hold one row at any width, and
          the label survives as the tooltip and the accessible name — nothing is lost to a
          screen reader. */}
      <nav className="admtabs admtabs-icons" data-tour="admtabs">
        <TabButton
          id="activity"
          tab={tab}
          onClick={setTab}
          label={t("admin.tab.activity")}
          icon={<Icon.bell />}
        />
        <TabButton
          id="centers"
          tab={tab}
          onClick={setTab}
          label={t("admin.tab.centers")}
          icon={<Icon.hospital />}
        />
        <TabButton
          id="submissions"
          tab={tab}
          onClick={setTab}
          label={t("admin.tab.submissions")}
          icon={<Icon.mail />}
          count={submissions.length}
        />
        <TabButton
          id="reports"
          tab={tab}
          onClick={setTab}
          label={t("admin.tab.reports")}
          icon={<Icon.alert />}
          count={reports.length}
        />
        {site.features.donations ? (
          <TabButton
            id="donations"
            tab={tab}
            onClick={setTab}
            label={t("admin.tab.donations")}
            icon={<Icon.heart />}
          />
        ) : null}
        {isAdmin ? (
          <TabButton
            id="volunteers"
            tab={tab}
            onClick={setTab}
            label={t("admin.tab.volunteers")}
            icon={<Icon.volunteer />}
            count={volunteers.length}
          />
        ) : null}
      </nav>

      {/* No <h1> here: the overlay's own header already says "Panel del equipo" directly
          above this, so a second copy was pure repetition eating the top of a 430px
          column. What is left is the thing the title could not tell you — WHO you are
          signed in as. The gear that used to float on the right of this row now sits in
          the header with the other two session controls: three buttons for the same
          session, on three different rows, was the arrangement worth fixing.

          No "back to map" link either: the map is on screen beside this panel and the
          overlay's ← closes it. The old link navigated to `/`, which tore the client tree
          down and re-resolved the session — which is what made it look like a sign-out. */}
      <div className="admhead">
        <span className="admwho">
          <b>{session.email}</b>
          <span className="admrole">{t(`admin.role.${session.role}` as DictKey)}</span>
        </span>
      </div>

      <Notice tone="info">{t("admin.liveNote")}</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="warn">{notice}</Notice> : null}

      {tab === "activity" ? (
        <div className="stack">
          {pendingTotal > 0 ? (
            <Notice tone="warn">{t("admin.pending", { n: pendingTotal })}</Notice>
          ) : (
            <p className="mut small">{t("admin.none")}</p>
          )}

          {/* Admin only: switching this on puts a notice across the whole public site. */}
          {isAdmin ? (
            <div className={`maint-toggle${maintenance ? " maint-toggle-on" : ""}`}>
              <div className="maint-toggle-txt">
                <div className="maint-toggle-title">
                  {t("admin.maintenance")}
                  <span className={`maint-pill${maintenance ? " maint-pill-on" : ""}`}>
                    {maintenance ? t("common.yes") : t("common.no")}
                  </span>
                </div>
                <div className="maint-toggle-hint">{t("admin.maintenanceHint")}</div>
              </div>
              <button
                type="button"
                className={`switch${maintenance ? " switch-on" : ""}`}
                role="switch"
                aria-checked={maintenance}
                aria-label={t("admin.maintenance")}
                onClick={() => void toggleMaintenance()}
              >
                <span className="switch-knob" />
              </button>
            </div>
          ) : null}

          <ul className="feed-list">
            {audit.map((entry) => (
              <li key={entry.id} className={`feed-item feed-${entry.entity}`}>
                <div className="feed-main">
                  <span className="feed-action">{entry.action}</span>
                  {entry.summary ? <span className="feed-sum">{entry.summary}</span> : null}
                </div>
                <div className="feed-meta">
                  <span>{ago(entry.created_at)}</span>
                  <span className="feed-dot">·</span>
                  <span>{entry.actor_email ?? t("admin.systemActor")}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "centers" ? (
        <div className="stack">
          <button type="button" className="addbtn" onClick={() => setCreating(true)}>
            <Icon.plus />
            {t("admin.newCenter")}
          </button>

          <div className="admsearch">
            <Icon.search />
            <input
              className="admsearch-i"
              value={query}
              placeholder={t("admin.searchCenters")}
              aria-label={t("admin.searchCenters")}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? (
              <button
                type="button"
                className="admsearch-x"
                aria-label={t("common.close")}
                onClick={() => setQuery("")}
              >
                ✕
              </button>
            ) : null}
          </div>

          {filtered.length === 0 ? <p className="mut">{t("admin.noCenters")}</p> : null}

          {filtered.map((center) => (
            <div key={center.id} className="arow">
              <div className="ai">
                <div className="aname">{center.name}</div>
                <div className="asub">
                  {t(`type.${center.type}` as DictKey)}
                  {center.region ? ` · ${helpers.regionLabel(center.region)}` : ""}
                  {!center.active ? ` · ${t("admin.hidden")}` : ""}
                </div>
                {center.region && !helpers.isKnownRegion(center.region) ? (
                  <Badge tone="warn">{t("admin.unknownRegion")}</Badge>
                ) : null}
              </div>
              <div className="aacts">
                {/* One tap to confirm a point is still open, without opening the form:
                    this is what a volunteer does after a round of phone calls. */}
                <button
                  type="button"
                  className="amini"
                  disabled={busy}
                  aria-label={t("admin.confirmOpen")}
                  title={t("admin.confirmOpen")}
                  onClick={() =>
                    void review(async () => {
                      const sb = getSupabase();
                      if (sb) await confirmCenterOpen(sb, center.id);
                    })
                  }
                >
                  <Icon.check />
                </button>
                <button
                  type="button"
                  className="amini"
                  aria-label={t("common.edit")}
                  title={t("common.edit")}
                  onClick={() => setEditing(center)}
                >
                  <Icon.pencil />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "donations" && site.features.donations ? (
        <div className="stack">
          <button type="button" className="addbtn" onClick={() => setCreatingDonation(true)}>
            <Icon.plus />
            {t("admin.newDonation")}
          </button>

          {donations.length === 0 ? <p className="mut">{t("admin.noDonations")}</p> : null}

          {donations.map((d) => (
            <div key={d.id} className="arow">
              <div className="ai">
                <div className="aname">{d.name}</div>
                <div className="asub">
                  {d.description ?? ""}
                  {!d.active ? ` · ${t("admin.hidden")}` : ""}
                </div>
              </div>
              <div className="aacts">
                <button
                  type="button"
                  className="amini"
                  aria-label={t("common.edit")}
                  title={t("common.edit")}
                  onClick={() => setEditingDonation(d)}
                >
                  <Icon.pencil />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "submissions" ? (
        <div className="stack">
          {submissions.length === 0 ? <p className="mut">{t("admin.none")}</p> : null}
          {submissions.map((sub) => (
            <article key={sub.id} className="subcard">
              <div className="subcard-head">
                <span className="subcard-kind">{t(`suggest.kind.${sub.kind}` as DictKey)}</span>
                <span>{ago(sub.created_at)}</span>
                {sub.name || sub.contact ? (
                  <span>{[sub.name, sub.contact].filter(Boolean).join(" · ")}</span>
                ) : null}
              </div>
              <p className="subcard-msg">{sub.message}</p>
              <div className="subcard-acts">
                <button
                  type="button"
                  className="btnp"
                  disabled={busy}
                  onClick={() =>
                    void review(async () => {
                      const sb = getSupabase();
                      if (sb) await reviewSubmission(sb, sub.id, "approved");
                    })
                  }
                >
                  {t("admin.reviewed")}
                </button>
                <button
                  type="button"
                  className="btng"
                  disabled={busy}
                  onClick={() =>
                    void review(async () => {
                      const sb = getSupabase();
                      if (sb) await reviewSubmission(sb, sub.id, "rejected");
                    })
                  }
                >
                  {t("admin.reject")}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "reports" ? (
        <div className="stack">
          {/* La promesa que sostiene todo el diseño, escrita donde el equipo la lee: estos
              avisos NO cambiaron nada. Los manda gente con cuenta y sin permisos de
              escritura, y el mapa sólo se mueve si alguien de acá lo mueve. */}
          <p className="mut">{t("admin.reports.intro")}</p>
          {reports.length === 0 ? <p className="mut">{t("admin.reports.none")}</p> : null}

          {reports.map((g) => (
            <article key={g.locationId} className="subcard">
              <div className="subcard-head">
                <strong>{g.locationName}</strong>
                {g.region ? <span>{helpers.regionLabel(g.region)}</span> : null}
                <span>{ago(g.ultimo)}</span>
              </div>

              {/* El recuento primero, y en grande. La pregunta que resuelve esta pantalla
                  no es "¿le creo a esta persona?" sino "¿le creo a las cinco que dicen lo
                  mismo?" — y esa se responde mucho mejor. */}
              <p className="subcard-msg">
                {g.sigueAbierto > 0 ? t("admin.reports.open", { n: g.sigueAbierto }) : null}
                {g.sigueAbierto > 0 && (g.yaCerro > 0 || g.datoIncorrecto > 0) ? " · " : null}
                {g.yaCerro > 0 ? t("admin.reports.closed", { n: g.yaCerro }) : null}
                {g.yaCerro > 0 && g.datoIncorrecto > 0 ? " · " : null}
                {g.datoIncorrecto > 0 ? t("admin.reports.wrong", { n: g.datoIncorrecto }) : null}
              </p>

              {/* Las notas, con quién las escribió. El nombre para mostrar, nunca el
                  correo: `fetchPendingReports` ni siquiera lo trae. */}
              {g.reports.filter((r) => r.note).length > 0 ? (
                <ul className="feed-list">
                  {g.reports
                    .filter((r) => r.note)
                    .map((r) => (
                      <li key={r.id} className="small">
                        <span className="mut">{r.by ?? t("admin.reports.anon")}: </span>
                        {r.note}
                      </li>
                    ))}
                </ul>
              ) : null}

              <div className="subcard-acts">
                {g.sigueAbierto >= g.yaCerro ? (
                  <button
                    type="button"
                    className="btnp"
                    disabled={busy}
                    onClick={() =>
                      void review(async () => {
                        const sb = getSupabase();
                        if (!sb) return;
                        await confirmCenterOpen(sb, g.locationId);
                        await resolveReports(sb, g.locationId, "applied");
                      })
                    }
                  >
                    {t("admin.reports.confirmOpen")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btnp"
                    disabled={busy}
                    onClick={() =>
                      void review(async () => {
                        const sb = getSupabase();
                        if (!sb) return;
                        await closeCenter(sb, g.locationId);
                        await resolveReports(sb, g.locationId, "applied");
                      })
                    }
                  >
                    {t("admin.reports.confirmClosed")}
                  </button>
                )}

                {/* "Dato incorrecto" no se puede resolver de un clic: hace falta leer la
                    ficha y arreglar lo que esté mal. Este botón lleva ahí. */}
                <button
                  type="button"
                  className="btng"
                  disabled={busy}
                  onClick={() => {
                    const target = centers.find((c) => c.id === g.locationId);
                    if (target) setEditing(target);
                  }}
                >
                  {t("admin.reports.edit")}
                </button>

                <button
                  type="button"
                  className="btng"
                  disabled={busy}
                  onClick={() =>
                    void review(async () => {
                      const sb = getSupabase();
                      if (sb) await resolveReports(sb, g.locationId, "dismissed");
                    })
                  }
                >
                  {t("admin.reports.dismiss")}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "volunteers" && isAdmin ? (
        <div className="stack">
          {volunteers.length === 0 ? <p className="mut">{t("admin.none")}</p> : null}
          {volunteers.map((v) => (
            <article key={v.id} className="subcard">
              <div className="subcard-head">
                <span className="aname">{v.name}</span>
                <span>{ago(v.created_at)}</span>
              </div>
              <div className="subcard-head">
                <span>{v.email}</span>
                {v.phone ? <span>{v.phone}</span> : null}
                {v.region ? <span>{helpers.regionLabel(v.region)}</span> : null}
                {v.profile ? <span>{v.profile}</span> : null}
              </div>
              {v.motivation ? <p className="subcard-msg">{v.motivation}</p> : null}
              <div className="subcard-acts">
                {/* Approve creates the account, grants the role and emails the welcome
                    with the manual (POST /api/staff/volunteers). Panel access publishes
                    live onto the map, so it stays an explicit human decision. */}
                <button
                  type="button"
                  className="btnp"
                  disabled={busy}
                  onClick={() => void reviewVolunteer(v.id, "approve")}
                >
                  {t("admin.approve")}
                </button>
                <button
                  type="button"
                  className="btng"
                  disabled={busy}
                  onClick={() => void reviewVolunteer(v.id, "reject")}
                >
                  {t("admin.reject")}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TabButton({
  id,
  tab,
  onClick,
  label,
  icon,
  count,
}: {
  id: Tab;
  tab: Tab;
  onClick: (t: Tab) => void;
  label: string;
  icon: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      className={`atab ${tab === id ? "atab-on" : ""}`}
      onClick={() => onClick(id)}
      aria-current={tab === id}
      aria-label={label}
      title={label}
    >
      <span className="atab-ic">{icon}</span>
      {count ? <span className="atab-badge">{count}</span> : null}
    </button>
  );
}
