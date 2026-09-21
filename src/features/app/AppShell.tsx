"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Center, Donation, SubmissionKind } from "@/domain/types";
import {
  EMPTY_FILTER,
  filterCenters,
  hasCoords,
  isDigital,
  pointsNeedingHelp,
  type CenterFilter,
} from "@/domain/center";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";
import { useCenters } from "@/features/app/useCenters";
import { useEmergency, useSite } from "@/features/app/SiteProvider";
import NewsTab from "@/features/news/NewsTab";
import { buildingLayers, defaultLayerState, mapLayers } from "@/domain/layers";
import type { AffectedZone } from "@/domain/area";
import { pointInRing } from "@/domain/area";
import { ZoneDrawBar, type ZoneDraft } from "@/features/area/ZoneEditor";
import { useStaffSession } from "@/features/admin/useStaffSession";
import AccountPanel from "@/features/account/AccountPanel";
import AccountMenu from "@/features/account/AccountMenu";
import AccountView from "@/features/account/AccountView";
import { useAccount } from "@/features/account/useAccount";
import { fetchDonations } from "@/data/donations";
import { fetchCenterById } from "@/data/centers";
import {
  EMPTY_PROFILE,
  fetchFeedCampaigns,
  fetchFeedPosts,
  fetchInitiativeProfile,
  fetchManagedLocations,
  type InitiativeProfile,
} from "@/data/initiatives";
import { buildFeed, type FeedMode } from "@/domain/feed";
import FeedPanel from "@/features/feed/FeedPanel";
import type { Campaign, InitiativePost } from "@/domain/types";
import InitiativePanel from "@/features/initiative/InitiativePanel";
import { getSupabase } from "@/lib/supabase/client";
import { useQuakes } from "@/features/hazard/useQuakes";
import LayersPanel, { type HazardLayers } from "@/features/hazard/LayersPanel";
import Brand from "@/features/app/Brand";
import Filters from "@/features/centers/Filters";
import TypeChips from "@/features/centers/TypeChips";
import CenterCard from "@/features/centers/CenterCard";
import DigitalCard from "@/features/centers/DigitalCard";
import PanelTabs, { type PanelTab } from "@/features/centers/PanelTabs";
import NearbyPanel from "@/features/nearby/NearbyPanel";
import { useMyLocation } from "@/features/nearby/useMyLocation";
import {
  DEFAULT_RADIUS,
  RADIUS_CHOICES,
  digitalCovering,
  nearbyPoints,
  nearestRegion,
  type RadiusKm,
} from "@/domain/nearby";
import CenterDetail from "@/features/centers/CenterDetail";
import { PanelSkeleton } from "@/ui/Skeleton";
import SuggestForm from "@/features/suggest/SuggestForm";
import DonateView from "@/features/donate/DonateView";
import ContactForm from "@/features/donate/ContactForm";
import VolunteerForm from "@/features/volunteer/VolunteerForm";
import GuidedTour from "@/features/tour/GuidedTour";
import { CookiePrefsLink } from "@/features/consent/CookieConsent";
import { PUBLIC_STEPS, STAFF_STEPS } from "@/features/tour/tourSteps";
import { watchConnection } from "@/features/suggest/offlineQueue";
import { useSiteHelpers } from "@/features/app/SiteProvider";
import { useNavStack, type NavEntry } from "@/features/app/useNavStack";
import { useDismiss } from "@/ui/useDismiss";

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
  /**
   * «Tu iniciativa»: onboarding y gestión, para quien gestiona un punto.
   *
   * Se llama `mine` y no `initiative` porque `EntryAction` ya usa esa palabra para otra
   * cosa —«registrar mi iniciativa», que lleva al formulario de sugerencias— y dos
   * significados con el mismo nombre en el mismo archivo se confunden solos.
   */
  | "mine"
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

/** La raíz de la pila: el mapa con su lista. Nunca se saca de ella. */
const LIST: NavEntry<View> = { view: "list", id: null };

/**
 * Las pantallas donde se ESCRIBE algo. En escritorio el mapa sigue a la vista junto a la
 * capa, y tocar un pin la sustituía por la ficha: se perdía lo escrito, o se quedaba sobre
 * el mapa público el pin a medio colocar de alguien del equipo. Con una de éstas arriba, un
 * pin no navega.
 */
const FORM_VIEWS: ReadonlySet<View> = new Set<View>(["suggest", "volunteer", "contact", "mine", "admin"]);

/** Con qué pila arranca la página, según lo que traiga la URL. */
function initialStack(centerId?: string, panel?: boolean, action?: EntryAction): NavEntry<View>[] {
  if (centerId) return [LIST, { view: "detail", id: centerId }];
  if (panel) return [LIST, { view: "admin", id: null }];
  if (action) return [LIST, { view: action === "initiative" ? "suggest" : action, id: null }];
  return [LIST];
}

/**
 * La dirección de cada pantalla: la misma que `app/page.tsx` sabe abrir, así que recargar o
 * copiar la barra lleva a donde se estaba. Y cerrar la pantalla la LIMPIA — antes un
 * `?a=donate` sobrevivía a cerrar Donar y lo volvía a abrir al recargar. Los demás
 * parámetros (`?lang=`) se conservan.
 */
function navUrl(entry: NavEntry<View>): string {
  const url = new URL(window.location.href);
  for (const key of ["c", "a", "panel", "mine"]) url.searchParams.delete(key);
  switch (entry.view) {
    case "detail":
      if (entry.id) url.searchParams.set("c", entry.id);
      break;
    case "needs":
    case "suggest":
    case "volunteer":
    case "donate":
    case "account":
      url.searchParams.set("a", entry.view);
      break;
    // Escríbenos no tiene dirección propia: se llega desde Donar, y recargar vuelve ahí.
    case "contact":
      url.searchParams.set("a", "donate");
      break;
    case "mine":
      url.searchParams.set("mine", "1");
      break;
    case "admin":
      url.searchParams.set("panel", "1");
      break;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

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
  initialMine,
}: {
  initialCenterId?: string;
  initialAction?: EntryAction;
  /** Opens straight into the staff panel — how `/admin` and `/login` land here now. */
  initialPanel?: boolean;
  /**
   * Abre «Tu iniciativa». Lo pone `?mine=1`, que es a donde vuelve quien acaba de
   * aceptar una invitación. El punto sale de `fetchManagedLocations`, no de la URL: si
   * viniera de fuera, cualquiera podría pedir el panel de gestión de un punto ajeno — y
   * aunque RLS lo pararía en cada consulta, la pantalla se dibujaría igual.
   */
  initialMine?: boolean;
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
    // Las zonas arrancan encendidas siempre que existan: son la respuesta a «¿me tocó a
    // mí?», que es la pregunta con la que entra la mayoría. Apagarlas es una decisión de
    // quien mira, no un valor por defecto.
    zones: true,
  }));
  // Las capas que declara ESTA emergencia. Vacío en un despliegue que todavía no adoptó la
  // tabla, y entonces el panel muestra solo los interruptores sísmicos de siempre.
  const emergency = useEmergency();
  const emergencyZones = useMemo(() => emergency?.zones ?? [], [emergency]);
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
  /**
   * Las zonas afectadas, sembradas de lo que trajo el servidor y actualizadas al guardar.
   *
   * En estado y no leídas de `emergency` en cada render porque se EDITAN desde acá mismo:
   * la identidad de la emergencia la resolvió el servidor al pintar la página y no vuelve
   * a cambiar sola, así que sin esto habría que recargar para ver el contorno que uno
   * acaba de dibujar.
   */
  const [zones, setZones] = useState<AffectedZone[]>(() => emergencyZones);
  /** La zona a medio dibujar. La miran el panel, el mapa y la barra de dibujo. */
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft | null>(null);
  /**
   * La zona ABIERTA: la que alguien tocó para ver qué hay dentro.
   *
   * Dibujarla contesta «hasta dónde llegó»; abrirla contesta la siguiente, que es la que
   * de verdad mueve a alguien: «y ahí dentro, ¿qué hay?». La lista del panel pasa a ser
   * la de esa zona y el mapa la encuadra.
   */
  const [zoneFocus, setZoneFocus] = useState<AffectedZone | null>(null);
  const drawingZone = zoneDraft?.drawing === true;

  const setZoneRing = useCallback((ring: [number, number][]) => {
    setZoneDraft((current) => (current ? { ...current, ring } : current));
  }, []);
  // Filled by whichever staff form is open. Dragging the pin calls straight into it, so
  // the coordinates land in the form as an event rather than as a cascade of renders.
  const pinDragRef = useRef<((at: { lat: number; lng: number }) => void) | null>(null);

  const moveDraftPin = useCallback((at: { lat: number; lng: number }) => {
    setDraftPin(at);
    pinDragRef.current?.(at);
  }, []);
  // Which of the two lists the panel shows: places, or initiatives with no seat. The
  // map does not depend on it — digital markers are drawn either way — only the list.
  const [panelTab, setPanelTab] = useState<PanelTab>("points");
  // El feed: publicaciones y campañas de todo el despliegue. Se ordenan y paginan en el
  // cliente — ver `domain/feed.ts` para por qué la cercanía no se calcula en el servidor.
  const [feedPosts, setFeedPosts] = useState<InitiativePost[]>([]);
  const [feedCampaigns, setFeedCampaigns] = useState<Campaign[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedMode, setFeedMode] = useState<FeedMode>("help");
  /**
   * El punto que gestiona esta persona, cuando NO está en `centers`.
   *
   * `centers` sólo trae los activos, así que un gestor cuyo punto acaba de desactivar el
   * equipo se quedaba con «Tu iniciativa» en blanco y sin explicación — justo cuando más
   * necesita entrar, a arreglar lo que haga falta para que vuelva.
   */
  const [managedCenter, setManagedCenter] = useState<Center | null>(null);
  // «Cerca»: la posición. NO sale del teléfono — ver `features/nearby/useMyLocation.ts`.
  // El radio se deriva más abajo, junto a la lista, para que la cuenta de la pestaña y
  // la lista hablen siempre del mismo número.
  const myLocation = useMyLocation();
  // Los puntos que ESTA persona gestiona, con la sesión de la que son. Casi siempre
  // vacío: gestionar un punto es raro. Ver el efecto de carga más abajo.
  const [managedFor, setManaged] = useState<{ uid: string; ids: string[] } | null>(null);
  // Campañas, agenda y entradas, con el punto del que son. Ver el efecto de carga abajo.
  const [loadedProfile, setLoadedProfile] = useState<{
    id: string;
    profile: InitiativeProfile;
  } | null>(null);
  // ── LA NAVEGACIÓN ES UNA PILA, Y EL HISTORIAL DEL NAVEGADOR LA REFLEJA ─────────
  //
  // Antes era un solo `view`: abrir algo lo sustituía y «Volver» siempre caía en la lista.
  // Escríbenos volvía a la lista y no a Donar; un punto abierto desde Mi cuenta, igual. Y
  // como nada escribía en el historial, el botón atrás del teléfono —el gesto con el que
  // todo el mundo cierra algo— sacaba de la aplicación entera.
  //
  // Ahora cada pantalla es un paso de la pila y una entrada del historial: atrás, sea el
  // del teléfono o «Volver», cierra SÓLO lo último. `view` y `selectedId` son la cima.
  const {
    top: navTop,
    current: navCurrent,
    push: navPush,
    replaceTop: navReplaceTop,
    openRoot: navOpenRoot,
    back: navBack,
    reset: navReset,
  } = useNavStack<View>({
    base: LIST,
    initial: initialStack(initialCenterId, initialPanel, initialAction),
    urlFor: navUrl,
  });
  const view = navTop.view;
  const selectedId = navTop.id;

  /**
   * Cambiar un filtro devuelve a la lista.
   *
   * Con la ficha de un punto abierta, tocar un chip de tipo cambiaba el filtro pero la
   * vista seguía siendo la ficha: la persona filtraba y no pasaba nada visible. Filtrar
   * es preguntar "qué hay", y la respuesta es la lista, no el punto que se estaba
   * mirando antes de preguntar.
   */
  const changeFilter = useCallback(
    (next: CenterFilter) => {
      setFilter(next);
      if (navCurrent().view === "detail") navBack();
    },
    [navCurrent, navBack],
  );

  // El menú del avatar. Vive acá y no dentro de `AccountMenu` porque abrirlo es lo que
  // dispara las dos consultas de abajo, y porque cerrarlo es parte de "abrir una vista".
  const [userMenu, setUserMenu] = useState(false);
  // "Correo confirmado" pertenece a la LLEGADA desde el enlace del correo, no a la vista:
  // sin esto reaparecía cada vez que se volvía a abrir la cuenta en la misma sesión.
  const [justConfirmed, setJustConfirmed] = useState(initialAction === "account");
  // Resolved only once the panel — or the avatar menu — is actually open. Ver
  // useStaffSession: la consulta del rol no entra en el camino crítico del mapa.
  const [fabOpen, setFabOpen] = useState(false);
  // Colaborar también lo pide: a quien ya es del equipo no se le ofrece sumarse a él.
  const staff = useStaffSession(view === "admin" || view === "account" || userMenu || fabOpen);
  // El perfil y los guardados, con la misma pereza. Una sola instancia para el menú y para
  // la vista: son la misma cuenta, y dos copias del recuento de guardados es cómo el menú
  // acaba diciendo 3 mientras el panel dice 4.
  const account = useAccount(userMenu || view === "account");
  // Entrar desde Mi cuenta cambia de persona con la vista ya abierta, y el rol se pedía
  // sólo al ACTIVARSE: quien entraba ahí con una cuenta del equipo seguía viendo
  // «Postularme» hasta abrir el avatar.
  const refreshStaff = staff.refresh;
  useEffect(() => {
    if (account.userId) refreshStaff();
  }, [account.userId, refreshStaff]);
  // "Register my initiative" is the same form with a different pre-selected kind: one
  // moderation queue, one shape, so the entry page needs no endpoint of its own.
  const [suggestKind] = useState<SubmissionKind>(
    initialAction === "initiative" ? "initiative" : "center",
  );
  // Arriving on the needs list with the sheet down would show an empty map: whoever
  // tapped "I want to help" asked for that list.
  const [open, setOpen] = useState(initialAction === "needs");
  const [folded, setFolded] = useState(false);

  const openZone = useCallback((zone: AffectedZone) => {
    setZoneFocus(zone);
    // El filtro es geométrico: lo que caiga dentro del anillo, sea del estado que sea.
    setFilter((f) => ({ ...f, zone: zone.ring }));
    setPanelTab("points");
    // La hoja SUBE. Con ella abajo, abrir una zona dejaba la respuesta —quién hay dentro—
    // asomando dos líneas por el borde inferior: el mapa se movía y no pasaba nada más.
    setOpen(true);
    setFolded(false);
  }, []);

  const closeZone = useCallback(() => {
    setZoneFocus(null);
    setFilter((f) => ({ ...f, zone: null }));
  }, []);

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
  // Los dos desplegables de este componente. `useDismiss` los cierra al tocar fuera, con
  // Escape y con atrás, y cierra cualquier otro menú abierto cuando se abre uno.
  const fabRef = useRef<HTMLDivElement>(null);
  const closeFab = useCallback(() => setFabOpen(false), []);
  useDismiss(fabOpen, closeFab, fabRef);
  useEffect(() => {
    // Someone who arrived with an intent ("I want to help", "register my initiative")
    // gets what they asked for, not a tour over it. The flag is left unset, so the tour
    // still greets them on a plain visit. Same for someone who just accepted a center
    // invitation (`?mine=1`): their initiative's onboarding is already on screen, and a
    // 13-step tour of the public map on top of it buries the one thing they came to do.
    if (initialAction || initialMine) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading an external store at mount
      if (!window.localStorage.getItem(TOUR_KEY)) setTourOpen(true);
    } catch {
      /* private mode: no tour rather than a tour on every load */
    }
  }, [initialAction, initialMine]);

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

  // Two lists from one load. Digital initiatives are not places: they never take a type
  // chip (so the type filter does not apply to them), they answer the region filter by
  // coverage, and the "needs help" count stays about points someone can travel to.
  const physical = useMemo(() => centers.filter((c) => !isDigital(c)), [centers]);
  const digitalAll = useMemo(() => centers.filter(isDigital), [centers]);
  const visible = useMemo(() => filterCenters(physical, filter), [physical, filter]);
  /**
   * Lo que hay dentro de la zona abierta, SIN los demás filtros.
   *
   * Sobre `visible` no: esa lista lleva encima el tipo que se haya marcado y lo que se
   * esté buscando, así que tocar «Refugios» hacía que la cabecera dijera «56 puntos
   * dentro» de una zona que tiene 186. Una zona tiene los que tiene; lo que cambia con
   * los filtros es lo que se está MIRANDO, y de eso ya informa la fila de contadores.
   *
   * El recuento de los que piden algo sale de `pointsNeedingHelp` —la misma función que
   * la barra de abajo— y no de `hasNeed` a secas: aquélla cuenta también los cerrados, y
   * un punto cerrado que dejó escrito lo que le hacía falta ya no está pidiendo ayuda.
   * Dos cifras de lo mismo en la misma pantalla tienen que salir de la misma pregunta.
   */
  const zoneInside = useMemo(
    () => (zoneFocus ? filterCenters(physical, { ...EMPTY_FILTER, zone: zoneFocus.ring }) : []),
    [zoneFocus, physical],
  );
  const zoneNeeds = useMemo(() => pointsNeedingHelp(zoneInside).length, [zoneInside]);
  // Sin `zone`: una iniciativa digital no está DENTRO de ninguna zona —no tiene sede, sirve
  // regiones enteras— y esconderla al abrir un área quitaría de en medio justo a quien sí
  // puede ayudar ahí sin estar ahí.
  const visibleDigital = useMemo(
    () => filterCenters(digitalAll, { ...filter, types: [], zone: null }),
    [digitalAll, filter],
  );
  const listed = panelTab === "digital" ? visibleDigital : visible;

  // Lo que la lista de puntos enseña ahora, para el ejemplo del recorrido (ver `openSample`).
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // El material del feed se pide UNA vez, al abrir su pestaña, y a partir de ahí el
  // scroll sólo revela lo que ya está en memoria. Ver `FeedPanel` para por qué no pagina
  // contra el servidor.
  useEffect(() => {
    if (panelTab !== "feed") return;
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void Promise.all([fetchFeedPosts(sb), fetchFeedCampaigns(sb)]).then(([p, c]) => {
      if (!vivo) return;
      setFeedPosts(p);
      setFeedCampaigns(c);
      setFeedLoading(false);
    });
    return () => {
      vivo = false;
    };
  }, [panelTab]);

  // ── «Cerca» ─────────────────────────────────────────────────────────────
  //
  // Su fuente NO es `visible`: de todos los filtros sólo hereda el buscador, que es el
  // único control que sigue a la vista en esta pestaña. Los chips de tipo se ocultan
  // aquí, y un filtro escondido que vacía una lista se lee como «no hay nada cerca de
  // ti» cuando lo que pasa es que quedó marcado «refugios» tres pestañas atrás. El
  // filtro de {region} sobra por la misma razón al revés: la posición ya dice la zona,
  // mejor que un desplegable.
  const nearSource = useMemo(
    () => filterCenters(centers, { ...EMPTY_FILTER, query: filter.query }),
    [centers, filter.query],
  );
  // Una sola pasada de distancias, ordenada. El radio no vuelve a medir nada: recorta.
  const nearAll = useMemo(
    () => (myLocation.fix ? nearbyPoints(nearSource, myLocation.fix, Infinity) : []),
    [nearSource, myLocation.fix],
  );

  // EL RADIO ES DERIVADO, NO UN ESTADO QUE UN EFECTO CORRIGE.
  //
  // Un radio en el que no hay nada no es un resultado, es un callejón: si a 2 km no
  // aparece nada y a 15 sí, la pestaña tiene que abrirse en el primero que tiene algo.
  // La forma obvia —un `useEffect` que hace `setNearRadius`— encadena un render de más
  // por cada posición nueva y deja el valor bueno un fotograma después del que se pinta.
  //
  // En vez de eso, lo elegido a mano se guarda JUNTO A LA POSICIÓN para la que se
  // eligió: mientras esa posición siga vigente manda la elección, y una posición nueva
  // vuelve sola al automático sin que nadie tenga que acordarse de reiniciarlo.
  const [radiusPick, setRadiusPick] = useState<{ km: RadiusKm; at: number } | null>(null);
  const autoRadius = useMemo<RadiusKm>(
    () => RADIUS_CHOICES.find((km) => nearAll.some((n) => n.km <= km)) ?? DEFAULT_RADIUS,
    [nearAll],
  );
  const fixAt = myLocation.fix?.at ?? 0;
  const nearRadius = radiusPick?.at === fixAt ? radiusPick.km : autoRadius;
  const pickRadius = useCallback(
    (km: RadiusKm) => setRadiusPick({ km, at: fixAt }),
    [fixAt],
  );

  const near = useMemo(
    () => nearAll.filter((n) => n.km <= nearRadius),
    [nearAll, nearRadius],
  );

  // La {region} más próxima decide qué iniciativas sin sede salen. Aproximación
  // deliberada —un centroide no es una frontera— y sin consecuencias: sólo elige a quién
  // mostrar. Los puntos físicos se filtran por distancia real, que no tiene ese error.
  const nearZone = useMemo(
    () => (myLocation.fix ? nearestRegion(site.country.regions, myLocation.fix) : null),
    [myLocation.fix, site.country.regions],
  );
  const nearDigital = useMemo(
    () => digitalCovering(nearSource, nearZone?.code ?? null),
    [nearSource, nearZone],
  );
  /**
   * El feed, ordenado. `account.favourites` sube lo guardado al principio y la posición
   * —si la hay— pesa la cercanía. Todo aquí, con lo que ya está en memoria.
   *
   * Con una zona abierta, el feed es EL DE SUS PUNTOS. Dibujar la zona contesta hasta
   * dónde llegó y abrirla contesta quién hay dentro; esto contesta la tercera, que es la
   * que tiene fecha: qué está pasando ahí esta semana. Se filtra sobre el resultado y no
   * sobre `centers` porque ese mapa es el índice con el que cada publicación encuentra su
   * punto: recortarlo dejaría publicaciones huérfanas fuera del feed en vez de fuera de
   * la zona.
   *
   * Las iniciativas sin sede se quedan fuera, como en la lista: no están dentro de ningún
   * sitio. Siguen enteras en su pestaña, que la zona no toca.
   */
  const feedItems = useMemo(() => {
    const all = buildFeed({
      centers,
      posts: feedPosts,
      campaigns: feedCampaigns,
      from: myLocation.fix,
      saved: account.favourites,
      mode: feedMode,
    });
    if (!zoneFocus) return all;
    return all.filter(
      (item) =>
        hasCoords(item.center) &&
        pointInRing(zoneFocus.ring, item.center.lat, item.center.lng),
    );
  }, [centers, feedPosts, feedCampaigns, myLocation.fix, account.favourites, feedMode, zoneFocus]);

  // Con un filtro de sitio puesto —una región, o una zona afectada abierta— la barra de
  // «N necesitan ayuda» tiene que contar DENTRO de ese sitio. Contando el país entero
  // mientras la lista enseña un barrio, los dos números de la misma pantalla se
  // contradicen y el grande hace pequeño al que importa.
  const needing = useMemo(
    () => pointsNeedingHelp(filter.region || filter.zone ? visible : physical),
    [visible, physical, filter.region, filter.zone],
  );
  const selected: Center | null = useMemo(
    () =>
      centers.find((x) => x.id === selectedId) ??
      // El respaldo para un punto gestionado que ya no está activo. Sólo entra si el id
      // coincide, así que nunca sustituye a otro punto.
      (managedCenter?.id === selectedId ? managedCenter : null),
    [centers, selectedId, managedCenter],
  );

  // Se pide sólo si hace falta: se gestiona algo, se está mirando, y no salió en la carga
  // general. En el caso normal —punto activo— esto no dispara ninguna petición.
  useEffect(() => {
    if (view !== "mine" || !selectedId) return;
    if (centers.some((c) => c.id === selectedId)) return;
    if (managedCenter?.id === selectedId) return;
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void fetchCenterById(sb, selectedId).then((c) => {
      if (vivo && c) setManagedCenter(c);
    });
    return () => {
      vivo = false;
    };
  }, [view, selectedId, centers, managedCenter]);

  // A shared link naming a point we cannot find (deleted, or a bad id) lands on the map
  // rather than on an empty panel. Derived, not corrected in an effect, so there is never
  // a frame showing an empty detail view.
  const activeView: View =
    view === "detail" && selectedId && !selected && !loading ? "list" : view;

  // Lo que la iniciativa cuenta de sí misma, al abrir su ficha.
  //
  // LO CARGADO SE GUARDA JUNTO AL PUNTO AL QUE PERTENECE, y lo que se muestra se DERIVA
  // de si ese punto sigue siendo el abierto. No es una filigrana: sin ello hay que vaciar
  // el estado antes de cada petición, y vaciarlo desde dentro del efecto encadena un
  // render de más —lo que aquí se resuelve solo— además de dejar dos agujeros abiertos:
  //
  //   • Tocar un pin y luego otro enseñaba las campañas del primero bajo el nombre del
  //     segundo mientras cargaba. En la conexión que este proyecto da por supuesta, eso
  //     es un rato largo atribuyéndole a alguien una meta de recaudación que no es suya.
  //   • Dos respuestas en vuelo llegan en el orden que quieran, y la lenta pisaba a la
  //     nueva.
  //
  // Con la pareja `{ id, profile }` las dos cosas se caen solas: una respuesta tardía se
  // guarda con el id de SU punto, y el derivado de abajo la ignora por no coincidir.
  useEffect(() => {
    if (activeView !== "detail" || !selectedId) return;
    const sb = getSupabase();
    if (!sb) return;
    const id = selectedId;
    void fetchInitiativeProfile(sb, id).then((p) => setLoadedProfile({ id, profile: p }));
  }, [activeView, selectedId]);

  const profile =
    loadedProfile && loadedProfile.id === selectedId ? loadedProfile.profile : EMPTY_PROFILE;

  // Qué puntos gestiona quien está dentro. Una consulta por sesión, no por ficha: quien
  // gestiona algo gestiona uno o dos puntos, y preguntarlo en cada pin que se toca sería
  // una petición por toque.
  //
  // Guardado junto al dueño y derivado, igual que el perfil de arriba y por lo mismo:
  // vaciar la lista al cerrar sesión desde dentro del efecto encadena un render, y deja
  // abierto que la respuesta de la sesión anterior llegue tarde y le enseñe a la nueva
  // los puntos de otra persona. Con el `uid` dentro, esa respuesta ya no coincide.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    // `account.userId` NO está listo al arrancar: el perfil se pide de forma perezosa, al
    // abrir el menú del avatar, para no gastar dos viajes en el arranque del mapa. Eso
    // está bien para la entrada del menú —que no existe hasta que se abre— y rompía
    // `?mine=1`, que es justo el caso de quien acaba de aceptar una invitación y no va a
    // abrir ningún menú.
    //
    // Así que sólo cuando la URL lo pide se resuelve la sesión por nuestra cuenta. El
    // arranque normal sigue sin pagar ese viaje.
    const conUid = account.userId
      ? Promise.resolve(account.userId)
      : initialMine
        ? sb.auth.getUser().then(({ data }) => data.user?.id ?? null)
        : Promise.resolve(null);

    void conUid.then((uid) => {
      if (!uid) return;
      return fetchManagedLocations(sb, uid).then((ids) => {
        setManaged({ uid, ids });
        // Quien acaba de aceptar una invitación aterriza aquí con `?mine=1`. Se abre en
        // cuanto se sabe QUÉ punto gestiona, que es lo que no se podía saber antes.
        //
        // La apertura vive dentro de este `.then` y no en un efecto aparte por dos
        // razones: el dato que hace falta llega justo aquí, y un `setState` suelto en el
        // cuerpo de un efecto encadena un render de más.
        const primero = ids[0];
        if (initialMine && primero) navOpenRoot({ view: "mine", id: primero });
      });
    });
    // `initialMine` es una constante de la carga de la página: no se lista como
    // dependencia porque no cambia, y listarla no cambiaría nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.userId]);

  const managed =
    managedFor && account.userId && managedFor.uid === account.userId ? managedFor.ids : [];

  // La lista y la ficha comparten el mismo hueco del panel. Al abrir una ficha se anota por
  // dónde iba la lista para devolverla ahí al volver: bajar cuarenta tarjetas, abrir una y
  // encontrarse arriba del todo al salir es tener que buscarla otra vez.
  const listRef = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);

  const openCenter = useCallback((id: string) => {
    const cur = navCurrent();
    if (FORM_VIEWS.has(cur.view)) return;
    if (cur.view === "detail") {
      // De ficha a ficha se sustituye: diez pines tocados no pueden ser diez «atrás».
      navReplaceTop({ view: "detail", id });
    } else {
      listScroll.current = listRef.current?.scrollTop ?? 0;
      navPush({ view: "detail", id });
    }
    // Opening a digital initiative — from its ring on the map, a saved list, a shared
    // link — lands "Back" on the list it belongs to, not on the points list.
    //
    // Salvo desde «Cerca», que ya lista digitales: ahí «Volver» tiene que devolver a la
    // lista de la que se salió. Cambiar de pestaña bajo el dedo pierde la posición y el
    // radio que esa persona acababa de elegir.
    const target = centersRef.current.find((c) => c.id === id);
    setPanelTab((tab) =>
      tab !== "nearby" && target && isDigital(target) ? "digital" : tab,
    );
    // Abrir el panel si estaba plegado.
    //
    // Tocar un pin con el panel cerrado no hacía nada visible: la ficha se pintaba dentro
    // de un panel que estaba oculto. Pedir ver un punto ES pedir que se abra donde se
    // muestra — quien lo cerró antes lo cerró para ver el mapa, no para dejar de poder
    // consultar un punto.
    setFolded(false);
    setOpen(true);
  }, [navCurrent, navPush, navReplaceTop]);

  function switchTab(next: PanelTab) {
    setPanelTab(next);
    // Switching lists is asking "what else is there": the answer is the list, with the
    // panel open — not the detail or the needs view that happened to be on screen.
    navReset();
    listScroll.current = 0;
    if (listRef.current) listRef.current.scrollTop = 0;
    setFolded(false);
    setOpen(true);
  }

  // Al volver de una ficha, la lista recupera por dónde iba.
  const showingDetailNow = view === "detail";
  useLayoutEffect(() => {
    if (!showingDetailNow && listRef.current) listRef.current.scrollTop = listScroll.current;
  }, [showingDetailNow]);

  /** Cierra la pantalla de arriba y vuelve a la de debajo — la de verdad, no la lista. */
  function back() {
    navBack();
    setJustConfirmed(false);
    // Leaving the panel takes the half-placed pin with it; otherwise it lingers over the
    // public map looking like a real point.
    setDraftPin(null);
  }

  /**
   * Abrir una pantalla de primer nivel —desde Colaborar, el avatar o la cabecera— sustituye
   * lo que hubiera encima de la lista en vez de apilarse. Ir de Donar a Mi cuenta desde el
   * menú no es un paso más hondo, es cambiar de sitio: atrás tiene que volver al mapa.
   */
  function goRoot(entry: NavEntry<View>) {
    setJustConfirmed(false);
    setDraftPin(null);
    navOpenRoot(entry);
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
    navReset();
    setJustConfirmed(false);
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
      closeViews: () => navReset(),
      showSheet: (v: boolean) => {
        setFolded(false);
        setOpen(v);
      },
      setFabOpen,
      setUserMenuOpen: setUserMenu,
      clearCenter: () => {
        if (navCurrent().view === "detail") navBack();
      },
      openSample: () => {
        // De lo que la lista enseña AHORA, y nunca una digital. Era el primer punto de la
        // carga entera: con un tipo marcado en el paso de los filtros podía no estar en la
        // lista, y si era una iniciativa sin sede, abrirla cambiaba el panel a la pestaña
        // Digitales por debajo del recorrido.
        const sample = visibleRef.current[0] ?? centersRef.current.find((c) => !isDigital(c));
        if (sample) openCenter(sample.id);
      },
      openDonate: () => {},
      openVolunteer: () => navOpenRoot({ view: "volunteer", id: null }),
      openAdmin: () => navOpenRoot({ view: "admin", id: null }),
      switchTab: () => {},
      editSample: () => {},
      clearEdit: () => {},
    }),
    [openCenter, navReset, navCurrent, navBack, navOpenRoot],
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
    <div className={`app${folded ? " sheetmin" : ""}${drawingZone ? " app-drawing" : ""}`}>
      <MapCanvas
        centers={visible}
        digital={visibleDigital}
        selectedId={selectedId}
        onSelect={openCenter}
        region={filter.region}
        quakes={seismic.quakes}
        contours={seismic.contours}
        layers={layers}
        extra={extraLayers}
        extraOn={extraOn}
        draftPin={view === "admin" ? draftPin : null}
        onDraftPinMove={moveDraftPin}
        zones={zones}
        showZones={layers.zones}
        draftRing={drawingZone ? (zoneDraft?.ring ?? []) : null}
        onDraftRingChange={setZoneRing}
        editingZoneId={zoneDraft?.id ?? null}
        onZoneSelect={openZone}
        focusZoneId={zoneFocus?.id ?? null}
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
          zones={zones}
          here={myLocation.fix}
          onZoneOpen={openZone}
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

          <Filters filter={filter} onChange={changeFilter} />

          <div className="hright">
            {/* LA BARRA LLEVA DOS ACCIONES, NO SEIS.
                Había además un sobre, un «?» y la bandera. El sobre abría «Falta un punto»,
                que ya es la primera opción de Colaborar, y parecía «contacto» sin llevar al
                formulario de contacto. La ayuda y el idioma se consultan una vez por visita
                y ahora viven en el menú del avatar. En 390px eran seis controles, cuatro por
                debajo de los 44px de ancho, peleando con el buscador por la misma fila. */}

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
              <div className="fabwrap" data-tour="fab" ref={fabRef}>
                {fabOpen ? (
                  <>
                    <div className="fab-menu">
                      {site.features.suggestions ? (
                        <button
                          type="button"
                          className="fab-opt"
                          onClick={() => {
                            setFabOpen(false);
                            goRoot({ view: "suggest", id: null });
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
                            goRoot({ view: "donate", id: null });
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
                      {/* A quien ya es del equipo no se le ofrece sumarse a él. */}
                      {site.features.volunteerSignup && !staff.session ? (
                        <button
                          type="button"
                          className="fab-opt"
                          onClick={() => {
                            setFabOpen(false);
                            goRoot({ view: "volunteer", id: null });
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
              onOpenAccount={() => goRoot({ view: "account", id: null })}
              onOpenPanel={() => goRoot({ view: "admin", id: null })}
              panelOpen={activeView === "admin"}
              onHelp={() => setTourOpen(true)}
              managesInitiative={managed.length > 0}
              onOpenInitiative={() => {
                // El primero de la lista: gestionar varios puntos es raro dentro de lo
                // raro, y un selector antes de haber visto ninguno sobra. El día que
                // alguien tenga tres, la lista va aquí.
                const primero = managed[0];
                if (primero) goRoot({ view: "mine", id: primero });
              }}
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

        {/* Las dos listas del panel: sitios a los que ir, e iniciativas sin sede. Las
            digitales no se filtran por tipo, así que los chips sólo salen con la lista de
            puntos; la búsqueda y la región valen para las dos. */}
        <PanelTabs
          tab={panelTab}
          counts={{
            // `null` hasta que hay posición: un 0 ahí se lee «no hay nada cerca de ti»
            // cuando lo que pasa es que nadie ha pedido la ubicación todavía.
            // El feed sin contador: un número ahí invita a «vaciarlo», y esto no es una
            // bandeja de entrada. Cuando no hay nada, la lista ya lo dice.
            feed: null,
            nearby: myLocation.fix ? near.length : null,
            points: visible.length,
            digital: visibleDigital.length,
          }}
          onChange={switchTab}
        />

        {/* Los filtros por tipo viven DENTRO del panel de puntos, no sobre el mapa.
            Acotan exactamente lo que ese panel lista, y tenerlos flotando aparte obligaba
            a mirar a dos sitios para entender por qué la lista mostraba lo que mostraba.
            Y desaparecen al abrir una ficha: seguían ahí encima del detalle, acotando una
            lista que en ese momento no está en pantalla — cinco controles que no hacen
            nada visible y que empujan la ficha media pantalla hacia abajo. */}
        {panelTab === "points" && !showingDetail ? (
          <TypeChips filter={filter} onChange={changeFilter} />
        ) : null}

        {showingDetail && selected ? (
          // La clave por punto hace que cada ficha se abra desde ARRIBA. Compartía elemento
          // con la lista y heredaba su desplazamiento: la ficha salía por la mitad, con
          // «Volver» fuera de la vista.
          //
          // `data-tour="ficha"` va AQUÍ y no en la capa de formularios, donde se quedó cuando
          // la ficha dejó de ser una capa. El paso del recorrido abría un punto de ejemplo, no
          // encontraba su ancla, lo cerraba en el acto y saltaba al siguiente: la ficha
          // aparecía y desaparecía y el recorrido parecía retroceder o saltarse el paso.
          <div className="list" key={`detail:${selected.id}`} data-tour="ficha">
            <button type="button" className="cdback" onClick={back}>
              <Icon.back />
              <span>{t("common.back")}</span>
            </button>
            {/* El canalón de la ficha vive AQUÍ, en un envoltorio, y no en `.list`.
                `.list` lo comparten la ficha y la lista de tarjetas, y esas tarjetas van a
                sangre de lado a lado por diseño. Sin este envoltorio la ficha no tenía
                margen lateral ninguno: los títulos de sección salían pegados al borde de
                la pantalla mientras las tarjetas parecían metidas hacia dentro —era su
                relleno interior— y el resultado era un borde izquierdo que temblaba al
                bajar. La barra de «Volver» se queda fuera a propósito: es una franja de
                lado a lado con su propia línea inferior. */}
            <div className="dbody">
              <CenterDetail center={selected} profile={profile} />
            </div>
          </div>
        ) : (
        <div className="list" key="list" ref={listRef}>
          {/* La lista de necesidades no tenía título ni forma de salir: se llegaba desde la
              barra de «N puntos necesitan ayuda» y, para irse, había que adivinar que una
              pestaña devolvía a la lista general. */}
          {activeView === "needs" ? (
            <div className="listhead">
              <button
                type="button"
                className="listhead-back"
                onClick={back}
                aria-label={t("common.back")}
                title={t("common.back")}
              >
                <Icon.back />
              </button>
              <b className="listhead-title">{t("needs.listTitle")}</b>
            </div>
          ) : null}

          {/* La zona abierta, encima de su propia lista.
              Dice tres cosas y en este orden: cuál es, cuánto de grave, y qué hay dentro
              —cuántos puntos y cuántos de ellos están pidiendo algo—. La nota de quien la
              dibujó va debajo: es lo único de acá que no sale de un cálculo, sino de
              alguien que estuvo ahí. */}
          {zoneFocus && activeView === "list" ? (
            <div className={`zonehead zonehead-s${zoneFocus.severity}`}>
              <button
                type="button"
                className="listhead-back"
                onClick={closeZone}
                aria-label={t("common.close")}
                title={t("common.close")}
              >
                <Icon.close />
              </button>
              <div className="zonehead-main">
                <b>{zoneFocus.label}</b>
                <span className="zonehead-meta">
                  {t(`area.sev.${zoneFocus.severity}` as DictKey)}
                  {" · "}
                  {t(zoneInside.length === 1 ? "area.insideOne" : "area.insideN", {
                    n: zoneInside.length,
                  })}
                  {zoneNeeds > 0 ? ` · ${t("area.insideNeeds", { n: zoneNeeds })}` : ""}
                </span>
                {zoneFocus.note ? <em className="zonehead-note">{zoneFocus.note}</em> : null}
              </div>
            </div>
          ) : null}
          {/* «Cerca» sustituye el cuerpo de la lista, no el panel: el pie con privacidad y
              términos se queda: es la pestaña que pide la ubicación, y esconder ahí el
              enlace de privacidad sería justo al revés de lo que hay que hacer. */}
          {panelTab === "feed" && activeView === "list" ? (
            <FeedPanel
              items={feedItems}
              mode={feedMode}
              onMode={setFeedMode}
              loading={feedLoading}
            />
          ) : panelTab === "nearby" && activeView === "list" ? (
            <NearbyPanel
              located={myLocation.fix !== null}
              status={myLocation.status}
              near={near}
              digital={nearDigital}
              zone={nearZone}
              radius={nearRadius}
              onRadius={pickRadius}
              onRequest={myLocation.request}
              onForget={myLocation.forget}
              onSelect={openCenter}
              onBrowseAll={() => switchTab("points")}
            />
          ) : (
          <>
          {/* Los dos contadores en una fila: cuántos puntos se están viendo y cuántos de
              ellos piden algo. Son la misma pregunta a dos niveles de detalle y estaban
              separados por toda la cabecera y la rejilla de filtros. */}
          {activeView === "list" ? (
            <div className="counters">
              <span className="hcount">
                <b>{listed.length}</b>{" "}
                {panelTab === "digital"
                  ? listed.length === 1
                    ? t("sheet.digital")
                    : t("sheet.digitals")
                  : listed.length === 1
                    ? t("sheet.point")
                    : t("sheet.points")}
              </span>
              {panelTab === "points" && site.features.needs && needing.length > 0 ? (
                <button
                  type="button"
                  className="needbar"
                  data-tour="refbar"
                  onClick={() => {
                    setOpen(true);
                    listScroll.current = 0;
                    navPush({ view: "needs", id: null });
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

          {configured && !loading && listed.length === 0 ? (
            <p className="empty">
              <b>{panelTab === "digital" ? t("digital.empty") : t("map.noResults")}</b>
              <br />
              {panelTab === "digital" ? t("digital.emptyHint") : t("map.noResultsHint")}
            </p>
          ) : null}

          {(activeView === "needs" ? needing : listed).slice(0, 300).map((center) =>
            isDigital(center) ? (
              <DigitalCard key={center.id} center={center} onSelect={openCenter} />
            ) : (
              <CenterCard key={center.id} center={center} onSelect={openCenter} />
            ),
          )}
          </>
          )}

          <nav className="wrapline sheetfoot">
            <Link className="small mut" href="/docs/privacidad">
              {t("footer.privacy")}
            </Link>
            <Link className="small mut" href="/docs/terminos">
              {t("footer.terms")}
            </Link>
            <CookiePrefsLink className="small mut" />
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
      {/* Dibujando, la capa del equipo se APARTA —no se desmonta—: en un teléfono es
          opaca y tapa el mapa entero, y hay que ver dónde se está tocando. Oculta con CSS
          en vez de sacada del árbol, así que al volver el panel está como se dejó: misma
          pestaña, mismas listas cargadas, mismo texto a medio escribir. */}
      {overlayOpen ? (
        <div className={`overlay${drawingZone ? " overlay-away" : ""}`}>
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
                        : activeView === "mine"
                          ? t("mine.kicker")
                          : activeView === "admin"
                            ? t(staff.session ? "admin.title" : "login.title")
                            : t("volunteer.title")}
            </span>
            {/* Sólo lo que es DEL PANEL: su recorrido. La sesión —salir, la contraseña, el
                idioma— vive en el avatar, que está en pantalla junto a este panel. Tenerla
                también aquí eran dos «salir» con dos nombres, uno a cada lado de la
                pantalla, y dos menús que se cerraban el uno al otro al abrirse. */}
            {activeView === "admin" && staff.session ? (
              <button
                type="button"
                className="staff-guide"
                aria-label={t("admin.howItWorks")}
                title={t("admin.howItWorks")}
                onClick={() => setStaffTourOpen(true)}
              >
                <Icon.question />
              </button>
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
                onWriteToUs={() => navPush({ view: "contact", id: null })}
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
                isStaff={staff.checked ? Boolean(staff.session) : null}
                onOpenPanel={() => goRoot({ view: "admin", id: null })}
                onVolunteer={() => navPush({ view: "volunteer", id: null })}
                justConfirmed={justConfirmed}
              />
            ) : null}
            {/* «Tu iniciativa». El punto sale de `selectedId`, que la entrada del menú
                acaba de fijar; mientras los centros no hayan cargado no hay nada que
                dibujar, y una pantalla a medias es peor que un «cargando». */}
            {activeView === "mine" ? (
              selected ? (
                <InitiativePanel center={selected} onClose={back} />
              ) : (
                <PanelSkeleton />
              )
            ) : null}
            {activeView === "admin" ? (
              staff.session ? (
                <AdminPanel
                  session={staff.session}
                  onDraftPin={setDraftPin}
                  onPinDrag={pinDragRef}
                  onPendingChange={setPending}
                  zones={zones}
                  onZones={setZones}
                  zoneDraft={zoneDraft}
                  onZoneDraft={setZoneDraft}
                />
              ) : staff.checked ? (
                /* No es del equipo. Puede ser que no haya entrado, o que haya entrado con
                   una cuenta de persona: `AccountPanel` distingue los dos casos y sólo
                   muestra el formulario de acceso en el primero. Poner `LoginForm` suelto
                   acá era pedirle la contraseña a alguien que ya la había puesto. */
                <AccountPanel
                  onSignedIn={staff.refresh}
                  onOpenAccount={() => navPush({ view: "account", id: null })}
                  onVolunteer={() => navPush({ view: "volunteer", id: null })}
                />
              ) : (
                <PanelSkeleton />
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Lo único que queda sobre el mapa mientras se marca un contorno. */}
      {zoneDraft && drawingZone ? (
        <ZoneDrawBar draft={zoneDraft} onDraft={setZoneDraft} />
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
