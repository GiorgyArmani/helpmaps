"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Center, Donation, SubmissionKind } from "@/domain/types";
import { EMPTY_FILTER, filterCenters, pointsNeedingHelp, type CenterFilter } from "@/domain/center";
import { COUNTRY, FEATURES, SEISMIC, storageKey } from "@/config";
import { Icon } from "@/ui/icons";
import { useI18n, useTimeAgo } from "@/i18n/context";
import { useCenters } from "@/features/app/useCenters";
import { useStaffSession } from "@/features/admin/useStaffSession";
import LoginForm from "@/features/admin/LoginForm";
import { fetchDonations } from "@/data/donations";
import { getSupabase } from "@/lib/supabase/client";
import { useQuakes } from "@/features/hazard/useQuakes";
import LayersPanel, { type HazardLayers } from "@/features/hazard/LayersPanel";
import Brand from "@/features/app/Brand";
import LangSwitcher from "@/features/app/LangSwitcher";
import Filters from "@/features/centers/Filters";
import CenterCard from "@/features/centers/CenterCard";
import CenterDetail from "@/features/centers/CenterDetail";
import SuggestForm from "@/features/suggest/SuggestForm";
import DonateView from "@/features/donate/DonateView";
import ContactForm from "@/features/donate/ContactForm";
import VolunteerForm from "@/features/volunteer/VolunteerForm";
import GuidedTour from "@/features/tour/GuidedTour";
import { PUBLIC_STEPS } from "@/features/tour/tourSteps";
import { watchConnection } from "@/features/suggest/offlineQueue";

// Leaflet touches `window` at import time, so the map never renders on the server.
const MapCanvas = dynamic(() => import("@/features/map/MapCanvas"), {
  ssr: false,
  loading: () => null,
});

// The staff panel is a big module that almost nobody opens, and it now lives in the same
// component as the public map — so it is split out rather than shipped to every visitor
// on a phone with one bar of signal.
const AdminPanel = dynamic(() => import("@/features/admin/AdminPanel"), {
  ssr: false,
  loading: () => null,
});

type View = "list" | "detail" | "needs" | "suggest" | "volunteer" | "donate" | "contact" | "admin";

/**
 * What the map opens ON, when the visitor arrived saying what they came for — today that
 * is the entry page (`/inicio`), whose two doors and campaign button land here. Resolved
 * from `?a=` in `app/page.tsx`, which also drops any action a feature switch has off.
 */
export type EntryAction = "needs" | "suggest" | "initiative" | "volunteer" | "donate";

const TOUR_KEY = storageKey("tour:v1");

/**
 * The country app.
 *
 * Layout is the one the original arrived at and it is not arbitrary: the map owns the
 * screen, the chrome floats over it, and the list lives in a sheet you can drag up or
 * fold to a strip. On desktop the sheet docks left as a panel so it stops covering the
 * pins it describes.
 *
 * Every `data-tour` attribute here is an anchor for the guided tour, which is COPIED
 * VERBATIM from the original app (`src/features/tour/`). Do not rename them — the deck
 * finds its targets by those strings, and steps whose target is missing are skipped
 * silently, which is what lets one deck serve every country and screen size.
 *
 * State lives here and nowhere else; the views below are presentational.
 */
export default function AppShell({
  initialCenterId,
  initialAction,
  initialPanel,
}: {
  initialCenterId?: string;
  initialAction?: EntryAction;
  /** Opens straight into the staff panel — how `/admin` and `/login` land here now. */
  initialPanel?: boolean;
}) {
  const { t, lang } = useI18n();
  const ago = useTimeAgo();
  const { centers, settings, loading, stale, cachedAt, configured } = useCenters();
  const seismic = useQuakes();

  const [filter, setFilter] = useState<CenterFilter>(EMPTY_FILTER);
  const [layers, setLayers] = useState<HazardLayers>(() => ({ ...SEISMIC.defaultOn }));
  /**
   * Where the point currently being edited sits, mirrored out of the staff form so the
   * map can draw it. This is the whole reason the panel moved onto the map: placing a
   * point used to be typing two decimals into a form on a different page and hoping.
   * Now the pin is on the map beside the form, and dragging it writes the numbers back.
   */
  const [draftPin, setDraftPin] = useState<{ lat: number; lng: number } | null>(null);
  // Filled by whichever staff form is open. Dragging the pin calls straight into it, so
  // the coordinates land in the form as an event rather than as a cascade of renders.
  const pinDragRef = useRef<((at: { lat: number; lng: number }) => void) | null>(null);

  const moveDraftPin = useCallback((at: { lat: number; lng: number }) => {
    setDraftPin(at);
    pinDragRef.current?.(at);
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(initialCenterId ?? null);
  const [view, setView] = useState<View>(() => {
    if (initialCenterId) return "detail";
    if (initialPanel) return "admin";
    if (!initialAction) return "list";
    return initialAction === "initiative" ? "suggest" : initialAction;
  });

  // Resolved only once the panel is actually open — see useStaffSession.
  const staff = useStaffSession(view === "admin");
  // "Register my initiative" is the same form with a different pre-selected kind: one
  // moderation queue, one shape, so the entry page needs no endpoint of its own.
  const [suggestKind] = useState<SubmissionKind>(
    initialAction === "initiative" ? "initiative" : "center",
  );
  // Arriving on the needs list with the sheet down would show an empty map: whoever
  // tapped "I want to help" asked for that list.
  const [open, setOpen] = useState(initialAction === "needs");
  const [folded, setFolded] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Loaded the first time the panel is opened, not with the map: most visits never open
  // it, and this is a screen budgeted for one bar of signal.
  const [donations, setDonations] = useState<Donation[] | null>(null);
  // Whether a first-time visitor has seen the tour lives in localStorage, which the server
  // cannot know. Reading it in the initializer made the hydration render disagree with the
  // server HTML (tour vs no tour), so it is read after mount instead: the first client
  // render matches the server, then the effect opens the tour on the next commit.
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    // Someone who arrived with an intent ("I want to help", "register my initiative")
    // gets what they asked for, not a tour over it. The flag is left unset, so the tour
    // still greets them on a plain visit.
    if (initialAction) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading an external store at mount
      if (!window.localStorage.getItem(TOUR_KEY)) setTourOpen(true);
    } catch {
      /* private mode: no tour rather than a tour on every load */
    }
  }, [initialAction]);

  // The tour's "open a real record" step needs the current list without the control
  // object being rebuilt (and the step's `before()` re-running) on every load tick.
  const centersRef = useRef(centers);
  useEffect(() => {
    centersRef.current = centers;
  }, [centers]);

  // Anything queued while offline goes out on its own as soon as there is signal.
  useEffect(() => watchConnection(), []);

  useEffect(() => {
    if (view !== "donate" || donations !== null) return;
    const sb = getSupabase();
    if (!sb) return;
    // fetchDonations never throws: an empty directory and a failed query look the same
    // here on purpose, because neither is worth an error screen over a side panel.
    void fetchDonations(sb).then(setDonations);
  }, [view, donations]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  }

  const visible = useMemo(() => filterCenters(centers, filter), [centers, filter]);
  const needing = useMemo(
    () => pointsNeedingHelp(filter.region ? visible : centers),
    [visible, centers, filter.region],
  );
  const selected: Center | null = useMemo(
    () => centers.find((x) => x.id === selectedId) ?? null,
    [centers, selectedId],
  );

  // A shared link naming a point we cannot find (deleted, or a bad id) lands on the map
  // rather than on an empty panel. Derived, not corrected in an effect, so there is never
  // a frame showing an empty detail view.
  const activeView: View =
    view === "detail" && selectedId && !selected && !loading ? "list" : view;

  const openCenter = useCallback((id: string) => {
    setSelectedId(id);
    setView("detail");
  }, []);

  function back() {
    setView("list");
    setSelectedId(null);
    // Leaving the panel takes the half-placed pin with it; otherwise it lingers over the
    // public map looking like a real point.
    setDraftPin(null);
  }

  function closeTour() {
    setTourOpen(false);
    try {
      window.localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* private mode: the tour simply shows again next time */
    }
  }

  /**
   * The handles the tour uses to drive the real app. Anything this base does not have
   * yet is a no-op: the corresponding step finds no anchor and is skipped, so the deck
   * stays byte-identical to the original and a clone enables steps by shipping the
   * feature, not by editing the copy.
   */
  const tourCtl = useMemo(
    () => ({
      closeViews: () => setView("list"),
      showSheet: (v: boolean) => {
        setFolded(false);
        setOpen(v);
      },
      setFabOpen,
      clearCenter: () => setSelectedId(null),
      openSample: () => {
        const sample = centersRef.current[0];
        if (sample) openCenter(sample.id);
      },
      openDonate: () => {},
      openVolunteer: () => setView("volunteer"),
      openAdmin: () => {},
      switchTab: () => {},
      editSample: () => {},
      clearEdit: () => {},
    }),
    [openCenter],
  );

  const overlayOpen = activeView !== "list" && activeView !== "needs";

  return (
    <div className={`app${folded ? " sheetmin" : ""}`}>
      <MapCanvas
        centers={visible}
        selectedId={selectedId}
        onSelect={openCenter}
        region={filter.region}
        quakes={seismic.quakes}
        contours={seismic.contours}
        layers={layers}
        draftPin={draftPin}
        onDraftPinMove={moveDraftPin}
      />

      <LayersPanel layers={layers} onChange={setLayers} state={seismic} />

      <header className="topbar">
        {settings.maintenance ? (
          <div className="maint-banner" role="status">
            <Icon.alert />
            {settings.notice ?? t("maintenance.default")}
          </div>
        ) : null}

        <div className="hrow">
          <Brand />
          <div className="hright">
            {FEATURES.suggestions ? (
              <button
                type="button"
                className="gear"
                data-tour="contact"
                aria-label={t("suggest.cta")}
                title={t("suggest.cta")}
                onClick={() => setView("suggest")}
              >
                <Icon.mail />
              </button>
            ) : null}

            {/* The two ways to give, promoted out of the FAB menu and into the header,
                where the original has them. Someone who came to help should not have to
                open a "+" menu to find out that helping is possible. */}
            {FEATURES.volunteerSignup ? (
              <button
                type="button"
                className="gear"
                data-tour="volunteer"
                aria-label={t("volunteer.cta")}
                title={t("volunteer.cta")}
                onClick={() => setView("volunteer")}
              >
                <Icon.volunteer />
              </button>
            ) : null}

            {FEATURES.donations ? (
              <button
                type="button"
                className="donate-btn"
                data-tour="donate"
                aria-label={t("donate.cta")}
                title={t("donate.cta")}
                onClick={() => setView("donate")}
              >
                <Icon.heart />
                <span className="donate-label">{t("donate.cta")}</span>
              </button>
            ) : null}

            {/* Staff sign-in. A PADLOCK, not a gear: a gear promises settings, and the
                spoked one this used to draw read as a brightness toggle at 19px — people
                pressed it expecting a theme switch. Ordered as in the original: the two
                things a visitor might want (write to us, how it works) bracket it, and
                the language button stays last where it is always in the same place. */}
            <button
              type="button"
              className="gear"
              data-tour="staffgear"
              aria-label={t("login.title")}
              title={t("login.title")}
              onClick={() => setView("admin")}
            >
              <Icon.lock />
            </button>

            <button
              type="button"
              className="gear"
              data-tour="help"
              aria-label={t("map.help")}
              title={t("map.help")}
              onClick={() => setTourOpen(true)}
            >
              <Icon.question />
            </button>

            <LangSwitcher />
          </div>
        </div>

        <Filters
          filter={filter}
          onChange={setFilter}
          centers={visible}
          selectedId={selectedId}
          onPickCenter={(id) => (id ? openCenter(id) : setSelectedId(null))}
        />

        {stale && centers.length > 0 ? (
          <div className="stale" role="status">
            <Icon.alert />
            <span>
              <b>{t("offline.stale")}</b>
              {cachedAt
                ? ` · ${t("offline.staleHint", { ago: ago(new Date(cachedAt).toISOString()) })}`
                : ""}
            </span>
          </div>
        ) : null}
      </header>

      {/* Colaborar: the way in for someone who wants to add something rather than find
          something. Two clearly-named options — one unlabelled button was ambiguous. */}
      {FEATURES.suggestions || FEATURES.volunteerSignup || FEATURES.donations ? (
        <div className="fabwrap" data-tour="fab">
          {fabOpen ? (
            <>
              <button
                type="button"
                className="fab-backdrop"
                aria-label={t("common.close")}
                onClick={() => setFabOpen(false)}
              />
              <div className="fab-menu">
                {FEATURES.suggestions ? (
                  <button
                    type="button"
                    className="fab-opt"
                    onClick={() => {
                      setFabOpen(false);
                      setView("suggest");
                    }}
                  >
                    <span className="fab-opt-ic">
                      <Icon.spark />
                    </span>
                    <span className="fab-opt-txt">
                      <b>{t("suggest.cta")}</b>
                      <small>{t("suggest.ctaHint")}</small>
                    </span>
                  </button>
                ) : null}
                {FEATURES.donations ? (
                  <button
                    type="button"
                    className="fab-opt"
                    onClick={() => {
                      setFabOpen(false);
                      setView("donate");
                    }}
                  >
                    <span className="fab-opt-ic">
                      <Icon.heart />
                    </span>
                    <span className="fab-opt-txt">
                      <b>{t("donate.cta")}</b>
                      <small>{t("donate.ctaHint")}</small>
                    </span>
                  </button>
                ) : null}
                {FEATURES.volunteerSignup ? (
                  <button
                    type="button"
                    className="fab-opt"
                    onClick={() => {
                      setFabOpen(false);
                      setView("volunteer");
                    }}
                  >
                    <span className="fab-opt-ic">
                      <Icon.hand />
                    </span>
                    <span className="fab-opt-txt">
                      <b>{t("volunteer.cta")}</b>
                      <small>{t("volunteer.ctaHint")}</small>
                    </span>
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
          <button
            type="button"
            className={`fab${fabOpen ? " fab-open" : ""}`}
            onClick={() => setFabOpen((v) => !v)}
          >
            <Icon.plus />
            {t("fab.cta")}
          </button>
        </div>
      ) : null}

      <section
        className={`sheet${open ? " sheet-open" : ""}${folded ? " sheet-min" : ""}`}
        data-tour="sheet"
      >
        <button
          type="button"
          className="hfold"
          aria-label={folded ? t("map.unfold") : t("map.fold")}
          title={folded ? t("map.unfold") : t("map.fold")}
          onClick={() => setFolded((v) => !v)}
        >
          <Icon.chevron style={{ transform: folded ? "rotate(-90deg)" : "rotate(90deg)" }} />
        </button>

        <button
          type="button"
          className="handle"
          onClick={() => {
            setFolded(false);
            setOpen((v) => !v);
          }}
          aria-expanded={open}
        >
          <span className="hbar" />
          <span className="hrow2">
            <span className="hcount">
              <b>{visible.length}</b> {visible.length === 1 ? t("sheet.point") : t("sheet.points")}
            </span>
            {filter.region ? (
              <span className="hctx">
                <span>{COUNTRY.regions.find((r) => r.code === filter.region)?.name}</span>
              </span>
            ) : null}
          </span>
        </button>

        <div className="list">
          {FEATURES.needs && needing.length > 0 && activeView === "list" ? (
            <button
              type="button"
              className="needbar"
              data-tour="refbar"
              onClick={() => {
                setOpen(true);
                setView("needs");
              }}
            >
              <Icon.heart />
              {needing.length === 1
                ? t("needs.barCountOne")
                : t("needs.barCount", { n: needing.length })}
              <Icon.chevron className="chev" />
            </button>
          ) : null}

          {!configured ? <p className="empty">{t("error.notConfigured")}</p> : null}

          {configured && !loading && visible.length === 0 ? (
            <p className="empty">
              <b>{t("map.noResults")}</b>
              <br />
              {t("map.noResultsHint")}
            </p>
          ) : null}

          {(activeView === "needs" ? needing : visible).slice(0, 300).map((center) => (
            <CenterCard key={center.id} center={center} onSelect={openCenter} />
          ))}

          <nav className="wrapline sheetfoot">
            <Link className="small mut" href="/docs/privacidad">
              {t("footer.privacy")}
            </Link>
            <Link className="small mut" href="/docs/terminos">
              {t("footer.terms")}
            </Link>
            {FEATURES.publicApi ? (
              <Link className="small mut" href="/docs/api">
                {t("footer.api")}
              </Link>
            ) : null}
            <a
              className="small mut"
              href="https://helpmaps.net"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("footer.network")}
            </a>
          </nav>
        </div>
      </section>

      {overlayOpen ? (
        <div className="overlay" data-tour="ficha">
          <div className="ovhead">
            <button type="button" className="oicon" onClick={back} aria-label={t("common.back")}>
              <Icon.back />
            </button>
            <span className="ohtitle">
              {activeView === "detail" && selected
                ? selected.name
                : activeView === "suggest"
                  ? t("suggest.title")
                  : activeView === "donate"
                    ? t("donate.title")
                    : activeView === "contact"
                      ? t("contact.title")
                      : activeView === "admin"
                        ? t(staff.session ? "admin.title" : "login.title")
                        : t("volunteer.title")}
            </span>
          </div>
          <div className="ovbody">
            {activeView === "detail" && selected ? <CenterDetail center={selected} /> : null}
            {activeView === "suggest" ? (
              <SuggestForm
                defaultKind={suggestKind}
                onDone={() => {
                  back();
                  setToast(t("suggest.done"));
                  window.setTimeout(() => setToast(null), 3500);
                }}
              />
            ) : null}
            {activeView === "volunteer" ? <VolunteerForm onDone={back} /> : null}
            {activeView === "donate" ? (
              <DonateView
                donations={donations ?? []}
                onWriteToUs={() => setView("contact")}
                onCopied={() => showToast(t("common.copied"))}
              />
            ) : null}
            {activeView === "contact" ? <ContactForm kind="donation" onDone={back} /> : null}
            {activeView === "admin" ? (
              staff.session ? (
                <AdminPanel
                  session={staff.session}
                  onDraftPin={setDraftPin}
                  onPinDrag={pinDragRef}
                  onSignedOut={() => {
                    staff.clear();
                    back();
                  }}
                />
              ) : staff.checked ? (
                <LoginForm onSignedIn={staff.refresh} />
              ) : (
                <p className="empty">{t("common.loading")}</p>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}

      {/* Mounted only while open: unmounting is what resets it to step 1, so there is no
          extra state to keep in sync. */}
      {tourOpen ? (
        <GuidedTour steps={PUBLIC_STEPS} lang={lang} ctl={tourCtl} onClose={closeTour} />
      ) : null}
    </div>
  );
}
