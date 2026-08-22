// Domain model — mirrors the Supabase schema in `db/`. Country-agnostic by construction:
// a region is a `string` code resolved against the active CountryConfig, never a union of
// one country's provinces. That single change is what makes this repo cloneable.

/**
 * What kind of place a pin is. Shared across countries; a country simply may have none
 * of a given type. `hospital` and `morgue` exist as informational pins even where the
 * patient features are off.
 */
export type LocationType =
  | "shelter"
  | "donation_centre"
  | "comedor"
  | "iniciativa"
  | "hospital"
  | "morgue";

export const LOCATION_TYPES: LocationType[] = [
  "shelter",
  "donation_centre",
  "comedor",
  "iniciativa",
  "hospital",
  "morgue",
];

export function isLocationType(v: unknown): v is LocationType {
  return typeof v === "string" && (LOCATION_TYPES as string[]).includes(v);
}

/** Operational status of a point. `null` means UNKNOWN and must render as unknown. */
export type CenterStatus = "abierto" | "lleno" | "cerrado";

export const CENTER_STATUSES: CenterStatus[] = ["abierto", "lleno", "cerrado"];

/**
 * Narrow an untrusted status. Anything unrecognised becomes null — nothing anywhere may
 * default to "abierto": telling someone a closed point is open is the one direction of
 * this field that gets a family across town to a shut door.
 */
export function toCenterStatus(v: unknown): CenterStatus | null {
  return typeof v === "string" && (CENTER_STATUSES as string[]).includes(v)
    ? (v as CenterStatus)
    : null;
}

/** Ways a point can be helped, beyond money. Keys are stable; labels are translated. */
export type HelpKind = "voluntariado" | "especie" | "oficios" | "difusion" | "economico";

export const HELP_KINDS: HelpKind[] = [
  "voluntariado",
  "especie",
  "oficios",
  "difusion",
  "economico",
];

/** Drop unknown keys instead of painting blank chips for them. */
export function helpKinds(values: readonly string[] | null | undefined): HelpKind[] {
  if (!values) return [];
  return HELP_KINDS.filter((k) => values.includes(k));
}

/** `locations` table. The join target for everything: pins, filters, detail routes. */
export interface Location {
  id: string;
  name: string;
  type: LocationType;
  /** Region code — matches a `Region.code` in the active CountryConfig. */
  region: string | null;
  municipality: string | null;
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  active: boolean;
  updated_at: string | null;
}

/**
 * `center_info` — the 1:1 companion holding what a point RECEIVES and NEEDS right now.
 * Separate from `locations` because needs change daily while a location almost never
 * does, and because staff edit them under different expectations.
 */
export interface CenterInfo {
  location_id: string;
  status: CenterStatus | null;
  /** Donation types the point accepts. */
  receives: string[];
  /** Free text: what they need right now. */
  needs: string | null;
  /** Non-monetary ways to help (initiatives especially). */
  help: HelpKind[];
  /** Free text category — initiatives appear faster than any enum could track. */
  category: string | null;
  description: string | null;
  schedule: string | null;
  contact_name: string | null;
  social_url: string | null;
  /** Animal-rescue point: flagged so people looking for human shelter aren't misdirected. */
  is_animal: boolean;
  /** Last time a human confirmed the point is still operating. */
  last_confirmed_at: string | null;
  updated_at: string | null;
  /** Provenance ("AcopioVE", "equipo", a partner feed). Drives the attribution line. */
  source: string | null;
  /** Upstream id when the row came from a partner feed. Also gates attribution. */
  external_id: string | null;
}

/** A location joined to its needs — what the map, list and detail all actually render. */
export interface Center extends Location {
  info: CenterInfo | null;
}

/** Public suggestion queue: anon may INSERT a pending row and can never read it back. */
export type SubmissionKind = "center" | "initiative" | "need" | "other";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Submission {
  id: string;
  kind: SubmissionKind;
  /** Free-form description of the point being suggested. */
  message: string;
  name: string | null;
  contact: string | null;
  /** Structured hints the form could collect (type, region, coords) — never trusted. */
  payload: Record<string, unknown> | null;
  status: SubmissionStatus;
  created_at: string;
}

/**
 * An organisation people can give money or goods to.
 *
 * Deliberately NOT a `Location`: it is not a place anyone should travel to, and putting
 * it on the map would send someone to an office door instead of to a point of help.
 */
export interface Donation {
  id: string;
  name: string;
  description: string | null;
  /** Social or web page — how a donor checks the organisation is real before giving. */
  social_url: string | null;
  /** Donation page → the "Donate" button. */
  donate_url: string | null;
  /** Free text with the details to transfer to. Shown with a copy button. */
  donate_info: string | null;
  sort: number;
  active: boolean;
  updated_at: string | null;
}

export interface AppSettings {
  maintenance: boolean;
  notice: string | null;
}

/**
 * `superadmin` administers the network registry (see `db/007_emergencies.sql`); `admin`
 * runs one emergency; `volunteer` publishes inside it.
 *
 * A superadmin is ALSO an admin everywhere this type is compared, matching `is_admin()` in
 * the database, which returns true for both. The two layers have to agree: if the UI were
 * stricter than RLS it would hide actions the database would have allowed, and a
 * superadmin would be locked out of the panel of the emergency they just created.
 */
export type StaffRole = "superadmin" | "admin" | "volunteer";

/** True for the roles that may delete and manage a team. */
export function isAdminRole(role: StaffRole | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

export interface StaffSession {
  userId: string;
  email: string | null;
  role: StaffRole;
}

export interface AuditEntry {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string | null;
  actor_email: string | null;
  actor_role: string | null;
  created_at: string;
}
