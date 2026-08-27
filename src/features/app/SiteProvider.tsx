"use client";

import { createContext, useContext, useMemo } from "react";
import { SITE, createSiteHelpers, type SiteHelpers } from "@/config";
import type { SiteConfig } from "@/config/types";
import type { EmergencyIdentity } from "@/config/fromRow";

/**
 * The resolved configuration, for client components.
 *
 * ── WHY A CONTEXT AND NOT JUST THE IMPORT ───────────────────────────────────
 *
 * A client component's imports are baked into the bundle at build time, so `SITE` there is
 * always the compiled preset — it cannot reflect a row somebody edited an hour ago. Even on
 * a single-country deployment that matters: the whole point of `db/007_emergencies.sql` is
 * that an admin can move the viewport or add an affected region without a rebuild, and the
 * map has to draw the new one.
 *
 * So the server resolves it once per request in `app/layout.tsx` and hands it down. The
 * value is a plain serialisable object, which is what lets it cross that boundary at all.
 *
 * ── THE DEFAULT IS THE PRESET, ON PURPOSE ───────────────────────────────────
 *
 * Reading this outside the provider gives the compiled preset rather than throwing. A
 * component rendered in isolation — a test, a story, an error boundary that lost its tree —
 * should show a slightly stale country, not crash. This application's failure mode must
 * never be a blank screen for someone looking for a shelter.
 */

interface SiteContextValue {
  site: SiteConfig;
  helpers: SiteHelpers;
  emergency: EmergencyIdentity | null;
}

function build(site: SiteConfig, emergency: EmergencyIdentity | null): SiteContextValue {
  return { site, helpers: createSiteHelpers(site), emergency };
}

const SiteContext = createContext<SiteContextValue>(build(SITE, null));

export function SiteProvider({
  site,
  emergency,
  children,
}: {
  site: SiteConfig;
  emergency: EmergencyIdentity | null;
  children: React.ReactNode;
}) {
  // Rebuilt only when the configuration itself changes. The helpers carry a lookup map
  // built from the region list, so rebuilding them on every render would throw that away
  // on each keystroke of the region filter.
  const resolved = useMemo(() => build(site, emergency), [site, emergency]);
  return <SiteContext.Provider value={resolved}>{children}</SiteContext.Provider>;
}

/** The configuration this page is rendering: the emergency's row, or the preset. */
export function useSite(): SiteConfig {
  return useContext(SiteContext).site;
}

/**
 * The same helpers `@/config` exports, bound to the resolved configuration.
 *
 * A client component migrates by swapping the import for this hook and nothing else:
 * `regionLabel(code)` says exactly what it said before.
 */
export function useSiteHelpers(): SiteHelpers {
  return useContext(SiteContext).helpers;
}

/**
 * The emergency this page belongs to, or null when the compiled preset is in charge.
 *
 * Null is the honest answer for a deployment that has not adopted the table, and every
 * caller has to handle it: it means "this deployment has one implicit emergency", which is
 * exactly how `emergency_id is null` reads in the database.
 */
export function useEmergency(): EmergencyIdentity | null {
  return useContext(SiteContext).emergency;
}

/**
 * The id to scope queries by, or null to not scope them at all.
 *
 * A thin alias over `useEmergency()` because that is what almost every caller wants, and
 * because naming it makes the null case impossible to pass over silently.
 */
export function useEmergencyId(): string | null {
  return useContext(SiteContext).emergency?.id ?? null;
}
