"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Center, Donation, SubmissionKind } from "@/domain/types";
import { EMPTY_FILTER, filterCenters, pointsNeedingHelp, type CenterFilter } from "@/domain/center";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { useCenters } from "@/features/app/useCenters";
import { useEmergency, useSite } from "@/features/app/SiteProvider";
import NewsTab from "@/features/news/NewsTab";
import { buildingLayers, defaultLayerState, mapLayers } from "@/domain/layers";
import { useStaffSession } from "@/features/admin/useStaffSession";
import AccountPanel from "@/features/account/AccountPanel";
import AccountMenu from "@/features/account/AccountMenu";
import AccountView from "@/features/account/AccountView";
import { useAccount } from "@/features/account/useAccount";
import { fetchDonations } from "@/data/donations";
import { getSupabase } from "@/lib/supabase/client";
import { useQuakes } from "@/features/hazard/useQuakes";
import LayersPanel, { type HazardLayers } from "@/features/hazard/LayersPanel";
import Brand from "@/features/app/Brand";
import LangSwitcher from "@/features/app/LangSwitcher";
import Filters from "@/features/centers/Filters";
import TypeChips from "@/features/centers/TypeChips";
import CenterCard from "@/features/centers/CenterCard";
import CenterDetail from "@/features/centers/CenterDetail";
import SuggestForm from "@/features/suggest/SuggestForm";
import DonateView from "@/features/donate/DonateView";
import ContactForm from "@/features/donate/ContactForm";
import VolunteerForm from "@/features/volunteer/VolunteerForm";
import GuidedTour from "@/features/tour/GuidedTour";
import { PUBLIC_STEPS, STAFF_STEPS } from "@/features/tour/tourSteps";
import { watchConnection } from "@/features/suggest/offlineQueue";
import { useSiteHelpers } from "@/features/app/SiteProvider";

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

// Lives in the header now, next to the other two session controls — but it is still staff
// code, so it is split out for the same reason the panel is: a visitor on one bar of
// signal should not download a password form they can never open.
const PasswordChange = dynamic(() => import("@/features/admin/PasswordChange"), {
  ssr: false,
  loading: () => null,
});

type View =
  | "list"
  | "detail"
  | "needs"
  | "suggest"
  | "volunteer"
  | "donate"
  | "contact"
  /** Mi cuenta: guardados, lo enviado, el nombre. Antes era la página `/cuenta`. */
  | "account"
  | "admin";

/**
 * What the map opens ON, when the visitor arrived saying what they came for — today that
 * is the entry page (`/inicio`), whose two doors and campaign button land here. Resolved
 * from `?a=` in `app/page.tsx`, which also drops any action a feature switch has off.
 */
export type EntryAction =
  | "needs"
  | "suggest"
  | "initiative"
  | "volunteer"
  | "donate"
  /** Aterriza en la cuenta: es a donde manda `/cuenta` tras confirmar el correo. */
  | "account";

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
  const helpers = useSiteHelpers();
  // Las banderas de los tours se namespacean por la emergencia RESUELTA. Eran constantes
  // de módulo ligadas al preset, así que dos emergencias abiertas en el mismo navegador
  // compartían la marca de "ya vi el tour" — y la segunda nunca lo mostraba.
  const TOUR_KEY = helpers.storageKey("tour:v1");
  // Aparte de la pública: un voluntario que ya descartó el tour de visitante igual tiene
  // que ver el del panel la primera vez que lo abre.
  const STAFF_TOUR_KEY = helpers.storageKey("stafftour:v1");
  const { t, lang } = useI18n();
  const { centers, settings, loading, configured } = useCenters();
  const seismic = useQuakes();

  const site = useSite();


  const [filter, setFilter] = useState<CenterFilter>(EMPTY_FILTER);
  // Los interruptores sísmicos arrancan como diga la FILA: leerlos del preset compilado
  // hacía que configurar "solo epicentros" en el registro no cambiara nada.
  const [layers, setLayers] = useState<HazardLayers>(() => ({
    ...site.hazard.seismic.defaultOn,
  }));
  // Las capas que declara ESTA emergencia. Vacío en un despliegue que todavía no adoptó la
  // tabla, y entonces el panel muestra solo los interruptores sísmicos de siempre.
  const emergency = useEmergency();
  const declaredLayers = useMemo(() => emergency?.layers ?? [], [emergency]);
  // El mapa principal dibuja las capas 2D; las de edificios 3D no se dibujan acá porque
  // son otro renderizador entero, y solo alimentan el botón que lleva a su vista.
  const extraLayers = useMemo(() => mapLayers(declaredLayers), [declaredLayers]);
  const scenes3d = useMemo(() => buildingLayers(declaredLayers), [declaredLayers]);
  // Se siembra una vez, desde lo que cada capa declara para sí. La emergencia la resuelve
  // el servidor por request y no cambia mientras la pestaña está abierta, así que no hay
  // nada que sincronizar después: un efecto acá solo podría pisar lo que alguien acaba de
  // encender.
  const [extraOn, setExtraOn] = useState<Record<string, boolean>>(() =>
    defaultLayerState(extraLayers),
  );
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

  /**
   * Cambiar un filtro devuelve a la lista.
   *
   * Con la ficha de un punto abierta, tocar un chip de tipo cambiaba el filtro pero la
   * vista seguía siendo la ficha: la persona filtraba y no pasaba nada visible. Filtrar
   * es preguntar "qué hay", y la respuesta es la lista, no el punto que se estaba
   * mirando antes de preguntar.
   */
  const changeFilter = useCallback((next: CenterFilter) => {
    setFilter(next);
    setView((current) => (current === "detail" ? "list" : current));
  }, []);

  // El menú del avatar. Vive acá y no dentro de `AccountMenu` porque abrirlo es lo que
  // dispara las dos consultas de abajo, y porque cerrarlo es parte de "abrir una vista".
  const [userMenu, setUserMenu] = useState(false);
  // "Correo confirmado" pertenece a la LLEGADA desde el enlace del correo, no a la vista:
  // sin esto reaparecía cada vez que se volvía a abrir la cuenta en la misma sesión.
  const [justConfirmed, setJustConfirmed] = useState(initialAction === "account");
  // Resolved only once the panel — or the avatar menu — is actually open. Ver
  // useStaffSession: la consulta del rol no entra en el camino crítico del mapa.
  const staff = useStaffSession(view === "admin" || userMenu);
  // El perfil y los guardados, con la misma pereza. Una sola instancia para el menú y para
  // la vista: son la misma cuenta, y dos copias del recuento de guardados es cómo el menú
  // acaba diciendo 3 mientras el panel dice 4.
  const account = useAccount(userMenu || view === "account");
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
  const [staffTourOpen, setStaffTourOpen] = useState(false);
  // Reported by the panel every time it loads. It stays at 0 for a public visitor, who
  // never opens the panel and so never fetches the queues — the lazy session check this
  // sits behind is the whole point (see useStaffSession).
  const [pending, setPending] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // First time a staff member opens the panel, walk them through it. This IS the
  // onboarding: the welcome email links to the written manual, but somebody who just got
  // access is already looking at the panel, and the rules that matter here (the pin, the
  // status field, what never gets published) are things to be told before the first
  // entry, not after.
  useEffect(() => {
    if (view !== "admin" || !staff.session) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external store at mount
      if (!window.localStorage.getItem(STAFF_TOUR_KEY)) setStaffTourOpen(true);
    } catch {
      /* private mode: no tour rather than one on every sign-in */
    }
  }, [view, staff.session]);

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
    // Abrir el panel si estaba plegado.
    //
    // Tocar un pin con el panel cerrado no hacía nada visible: la ficha se pintaba dentro
    // de un panel que estaba oculto. Pedir ver un punto ES pedir que se abra donde se
    // muestra — quien lo cerró antes lo cerró para ver el mapa, no para dejar de poder
    // consultar un punto.
    setFolded(false);
    setOpen(true);
  }, []);

  function back() {
    setView("list");
    setJustConfirmed(false);
    setSelectedId(null);
    // The menu is header state, not panel state, so it outlives the view that owns it —
    // without this it would be hanging open the next time the panel is opened.
    setSettingsOpen(false);
    // Leaving the panel takes the half-placed pin with it; otherwise it lingers over the
    // public map looking like a real point.
    setDraftPin(null);
  }

  /**
   * Signing out closes the panel and leaves the map exactly as it was — no navigation.
   * The map is the product; tearing the client tree down to re-render a page that is
   * already on screen is a second of blank on a bad connection, for nothing.
   *
   * Sirve para las dos sesiones. Es una sola: la diferencia entre una persona y alguien
   * del equipo es un rol en una tabla, no otra credencial, y tener dos botones de salir
   * era prometer una separación que no existe.
   */
  async function signOut() {
    await getSupabase()?.auth.signOut();
    staff.clear();
    account.refresh();
    setPending(0);
    setUserMenu(false);
    back();
  }

  function closeTour() {
    setTourOpen(false);
    try {
      window.localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* private mode: the tour simply shows again next time */
    }
  }

  function closeStaffTour() {
    setStaffTourOpen(false);
    try {
      window.localStorage.setItem(STAFF_TOUR_KEY, "1");
    } catch {
      /* private mode: it simply shows again next time */
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
      openAdmin: () => setView("admin"),
      switchTab: () => {},
      editSample: () => {},
      clearEdit: () => {},
    }),
    [openCenter],
  );

  // Ver el bloque del aviso más abajo para el orden de precedencia.
  const inMaintenance = settings.maintenance || emergency?.maintenance === true;
  const bannerText =
    emergency?.notice ??
    (inMaintenance ? settings.notice ?? t("maintenance.default") : null);

  // La ficha de un punto NO es una capa aparte: se muestra dentro del panel de puntos,
  // en lugar de su lista. Como capa superpuesta duplicaba la superficie —dos paneles del
  // mismo ancho, uno encima del otro— y al tocar un pin aparecía tapando el panel que ya
  // estaba abierto. Los formularios y el panel del equipo sí siguen siendo capa: ahí se
  // viene a hacer una sola cosa y el mapa no hace falta detrás.
  const overlayOpen =
    activeView !== "list" && activeView !== "needs" && activeView !== "detail";
  const showingDetail = activeView === "detail" && selected !== null;

  // El menú de Colaborar ya no comparte columna con los controles del mapa: se despliega
  // desde la barra de arriba y no los cruza, así que no hace falta apartarlos.
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
        extra={extraLayers}
        extraOn={extraOn}
        draftPin={draftPin}
        onDraftPinMove={moveDraftPin}
      />

      {/* Aparece cuando hay ALGO que mostrar en 3D: un conjunto de edificios, o los puntos
          del mapa sobre el relieve. Antes exigía los edificios, y como casi ningún
          despliegue tiene ese dataset, el botón sólo existía con las capas de demostración
          puestas — y al quitarlas se llevó la ruta por delante.

          El argumento original sigue en pie y por eso el guardia no desaparece: un botón
          que lleva a una escena vacía de una zona de desastre se lee como "no pasó nada".
          Lo que cambia es qué cuenta como no-vacía.

          El `?l=` sólo viaja si hay edificios: sin ellos no hay conjunto que elegir. */}
      {scenes3d.length > 0 || visible.length > 0 ? (
        <Link
          href={scenes3d.length > 0 ? `/3d?l=${encodeURIComponent(scenes3d[0]!.id)}` : "/3d"}
          className="btn3d"
          title={scenes3d[0]?.label ?? t("scene3d.pointsTitle")}
        >
          <span className="btn3d-txt">3D</span>
        </Link>
      ) : null}

      {/* Las dos lengüetas del canto, en UNA columna.
          Cada una traía su propio `top` en píxeles y había que mantenerlos en sincronía a
          mano. El alto de una lengüeta depende del largo de su rótulo —o sea del idioma—
          así que el margen entre ambas cambiaba al traducir y con una palabra más larga
          volvían a solaparse. Acá el orden lo da el DOM y la separación la da el `gap`. */}
      <div className="sidetabs">
        <LayersPanel
          layers={layers}
          onChange={setLayers}
          state={seismic}
          extra={extraLayers}
          extraOn={extraOn}
          onExtraChange={setExtraOn}
        />
        <NewsTab />
      </div>

      <header className="topbar">
        {/* El aviso sobre el mapa.
            Dos orígenes, y el más específico manda: `app_settings` es el interruptor de
            toda la INSTALACIÓN, y `emergencies.notice` es el de UNA emergencia. Un aviso
            de la emergencia gana porque es quien sabe qué le pasa a su propio mapa.
            Y se muestra con o sin modo mantenimiento: un aviso sin mantenimiento es el
            caso corriente —"estos datos son de prueba", "el equipo está reverificando"—
            y antes no había forma de decirlo sin apagar el mapa entero. */}
        {bannerText ? (
          <div className="maint-banner" role="status">
            <Icon.alert />
            {bannerText}
          </div>
        ) : null}

        {/* Barra unificada, al modo de la de macOS: marca, buscador, filtros y acciones en
            un solo bloque translúcido en vez de tres bandas apiladas sobre el mapa. Antes
            el buscador y los desplegables vivían en su propia fila debajo de esta, y entre
            las dos se comían el tercio superior del mapa antes de mostrar un solo pin. */}
        <div className="macbar">
          <Brand />

          <Filters
            filter={filter}
            onChange={changeFilter}
            centers={visible}
            selectedId={selectedId}
            onPickCenter={(id) => (id ? openCenter(id) : setSelectedId(null))}
          />

          <div className="hright">
            {site.features.suggestions ? (
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
            {/* "Sumarme al equipo" salió de la barra: sigue estando, dentro de Colaborar,
                que es donde viven las tres formas de aportar. Como icono suelto competía
                con ellas por el mismo sitio y duplicaba una de las tres. */}

            {/* Colaborar ocupa el lugar que tenía Donar.
                Donar era UNA de las tres formas de colaborar y estaba promovida por
                encima de las otras dos, mientras el botón que las contenía a las tres
                flotaba en la esquina opuesta. Ahora hay un solo punto de entrada para
                quien viene a aportar algo, y donar es una opción dentro de él. */}
            {/* Colaborar: the way in for someone who wants to add something rather than find
                something. Two clearly-named options — one unlabelled button was ambiguous. */}
            {site.features.suggestions || site.features.volunteerSignup || site.features.donations ? (
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
                      {site.features.suggestions ? (
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
                      {site.features.donations ? (
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
                      {site.features.volunteerSignup ? (
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

            {/* Tu cuenta, al final de la barra.
                Este hueco lo ocupaba un candado que sólo sabía decir "entrar al panel del
                equipo", y estaba en medio de la fila. Ahora es el avatar, en el sitio y con
                el gesto que cualquiera trae aprendidos de otro mapa: tu inicial en la
                esquina y, debajo, tus puntos guardados, tu cuenta y la salida. El panel del
                equipo es una entrada más de ese menú —lo tiene una de cada mil personas que
                abren esto— y conserva sobre el avatar su recuento de pendientes, que es lo
                único que no podía perderse por el camino. */}
            <AccountMenu
              open={userMenu}
              onOpenChange={setUserMenu}
              account={account}
              staff={staff}
              pending={pending}
              volunteerEnabled={site.features.volunteerSignup}
              onOpenAccount={() => setView("account")}
              onOpenPanel={() => setView("admin")}
              onOpenVolunteer={() => setView("volunteer")}
              onSignOut={() => void signOut()}
            />
          </div>
        </div>

        {/* No offline banner here. It used to sit under the filters, and any form of it —
            block or chip — is one more thing between the reader and the map, shown at the
            exact moment their connection is already making the app harder to use. The
            freshness that decides whether a trip is worth making is per-point and already
            on the card and the detail view (`CenterStatus`), where someone is looking when
            the question occurs to them. `useCenters` still tracks `stale` / `cachedAt` for
            anything that wants them. */}
      </header>

      {/* Lengüeta del panel de puntos, espejo de las de capas y noticias en el otro canto.
          Sin ella el panel se leía como una tarjeta flotante y no como algo plegado que se
          puede tirar del borde. En teléfono no aparece: ahí el panel es una hoja que sube
          desde abajo y se pliega a una tira, que es la forma correcta para el pulgar. */}
      {folded ? (
        <div className="pointsctl">
          <button
            type="button"
            className="sidetab sidetab-left"
            aria-expanded={false}
            aria-label={t("map.unfold")}
            title={t("map.unfold")}
            onClick={() => setFolded(false)}
          >
            <Icon.chevron className="sidetab-ch" />
            <span className="sidetab-txt">{t("map.points")}</span>
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
          {/* La dirección la pone el CSS: el panel se pliega hacia ABAJO en el teléfono
              y hacia el CANTO IZQUIERDO en escritorio, así que un ángulo fijo apuntaba
              al lado equivocado en uno de los dos. */}
          <Icon.chevron />
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
          {filter.region ? (
            <span className="hrow2">
              <span className="hctx">
                <span>{site.country.regions.find((r) => r.code === filter.region)?.name}</span>
              </span>
            </span>
          ) : null}
        </button>

        {/* Los filtros por tipo viven DENTRO del panel de puntos, no sobre el mapa.
            Acotan exactamente lo que ese panel lista, y tenerlos flotando aparte obligaba
            a mirar a dos sitios para entender por qué la lista mostraba lo que mostraba. */}
        <TypeChips filter={filter} onChange={changeFilter} />

        {showingDetail && selected ? (
          <div className="list">
            <button type="button" className="cdback" onClick={back}>
              <Icon.back />
              <span>{t("common.back")}</span>
            </button>
            <CenterDetail center={selected} />
          </div>
        ) : (
        <div className="list">
          {/* Los dos contadores en una fila: cuántos puntos se están viendo y cuántos de
              ellos piden algo. Son la misma pregunta a dos niveles de detalle y estaban
              separados por toda la cabecera y la rejilla de filtros. */}
          {activeView === "list" ? (
            <div className="counters">
              <span className="hcount">
                <b>{visible.length}</b>{" "}
                {visible.length === 1 ? t("sheet.point") : t("sheet.points")}
              </span>
              {site.features.needs && needing.length > 0 ? (
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
            </div>
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
            {site.features.publicApi ? (
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
        )}
      </section>

      {/* La capa: formularios y panel del equipo, a altura completa. La ficha de un punto
          ya NO pasa por acá — vive dentro del panel de puntos, en lugar de su lista. */}
      {overlayOpen ? (
        <div className="overlay" data-tour="ficha">
          <div className="ovhead">
            <button type="button" className="oicon" onClick={back} aria-label={t("common.back")}>
              <Icon.back />
            </button>
            <span className="ohtitle">
              {activeView === "suggest"
                  ? t("suggest.title")
                  : activeView === "donate"
                    ? t("donate.title")
                    : activeView === "contact"
                      ? t("contact.title")
                      : activeView === "account"
                        ? t(account.userId ? "account.title" : "account.signIn")
                        : activeView === "admin"
                          ? t(staff.session ? "admin.title" : "login.title")
                          : t("volunteer.title")}
            </span>
            {/* Session actions belong to the header, next to the title that names the
                session — not folded into a menu inside the body. Replaying the
                walkthrough is the first thing someone reaches for when a field is
                unclear, and a sign-out has to be visible on a machine that gets handed
                around. */}
            {activeView === "admin" && staff.session ? (
              <>
                <div className="admsettings">
                  <button
                    type="button"
                    className={`staff-guide${settingsOpen ? " staff-guide-on" : ""}`}
                    aria-expanded={settingsOpen}
                    aria-label={t("admin.settings")}
                    title={t("admin.settings")}
                    onClick={() => setSettingsOpen((v) => !v)}
                  >
                    <Icon.gear />
                  </button>
                  {settingsOpen ? (
                    <>
                      <button
                        type="button"
                        className="layers-backdrop"
                        aria-label={t("common.close")}
                        onClick={() => setSettingsOpen(false)}
                      />
                      <div className="admmenu" role="group" aria-label={t("admin.settings")}>
                        {/* Only the password lives here. The other two session actions
                            are buttons in this same row — a menu for a single form is
                            worth it because the form needs the room; a menu for a
                            sign-out is just a sign-out you cannot find. */}
                        <PasswordChange />
                      </div>
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="staff-guide"
                  aria-label={t("admin.howItWorks")}
                  title={t("admin.howItWorks")}
                  onClick={() => setStaffTourOpen(true)}
                >
                  <Icon.question />
                </button>
                <button type="button" className="signout" onClick={() => void signOut()}>
                  {t("login.signOut")}
                </button>
              </>
            ) : null}
          </div>
          <div className="ovbody">
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
            {/* Mi cuenta. `centers` entra entero y no una consulta de guardados: los
                puntos ya están en memoria, así que la lista sale del mapa que la persona
                está mirando y tocar uno lo abre ahí mismo. */}
            {activeView === "account" ? (
              <AccountView
                account={account}
                centers={centers}
                onOpenCenter={openCenter}
                onVolunteer={() => setView("volunteer")}
                justConfirmed={justConfirmed}
              />
            ) : null}
            {activeView === "admin" ? (
              staff.session ? (
                <AdminPanel
                  session={staff.session}
                  onDraftPin={setDraftPin}
                  onPinDrag={pinDragRef}
                  onPendingChange={setPending}
                />
              ) : staff.checked ? (
                /* No es del equipo. Puede ser que no haya entrado, o que haya entrado con
                   una cuenta de persona: `AccountPanel` distingue los dos casos y sólo
                   muestra el formulario de acceso en el primero. Poner `LoginForm` suelto
                   acá era pedirle la contraseña a alguien que ya la había puesto. */
                <AccountPanel
                  onSignedIn={staff.refresh}
                  onOpenAccount={() => setView("account")}
                  onVolunteer={() => setView("volunteer")}
                />
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

      {/* The staff deck. It has always existed in `tourSteps.ts` and was never launched:
          nothing called `openAdmin`, and while the panel was its own route there was no
          way for a tour running over the map to drive it. */}
      {staffTourOpen ? (
        <GuidedTour steps={STAFF_STEPS} lang={lang} ctl={tourCtl} onClose={closeStaffTour} />
      ) : null}
    </div>
  );
}
