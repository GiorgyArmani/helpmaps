import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppSettings,
  AuditEntry,
  StaffRole,
  StaffSession,
  Submission,
  SubmissionKind,
} from "@/domain/types";

// Reads the public app settings plus everything behind the staff gate. The gate itself
// is RLS: this module asks, and the database decides. A UI check is a convenience for
// the person, never the control.

export async function fetchSettings(sb: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await sb
    .from("app_settings")
    .select("maintenance,notice")
    .eq("id", true)
    .maybeSingle();
  // A missing table (migration not run yet) must not take the map down with it.
  if (error || !data) return { maintenance: false, notice: null };
  return {
    maintenance: data.maintenance === true,
    notice: typeof data.notice === "string" && data.notice.trim() ? data.notice : null,
  };
}

export async function setMaintenance(sb: SupabaseClient, on: boolean): Promise<void> {
  const { error } = await sb
    .from("app_settings")
    .update({ maintenance: on, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw error;
}

/** Who is signed in, and with what role. `null` means "not staff" — including logged out. */
export async function fetchStaffSession(sb: SupabaseClient): Promise<StaffSession | null> {
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return null;
  const { data, error } = await sb
    .from("staff_users")
    .select("role,email")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  const role = data.role === "admin" ? "admin" : "volunteer";
  return { userId: user.id, email: data.email ?? user.email ?? null, role: role as StaffRole };
}

// ---------------------------------------------------------------------------
// Public suggestions
// ---------------------------------------------------------------------------

export interface SubmissionDraft {
  kind: SubmissionKind;
  message: string;
  name: string | null;
  contact: string | null;
  payload: Record<string, unknown> | null;
}

/**
 * Anyone may create a suggestion; nobody outside the team may read one back. The status
 * is not sent from the client — the DB trigger forces 'pending' regardless.
 */
export async function createSubmission(
  sb: SupabaseClient,
  draft: SubmissionDraft,
): Promise<void> {
  const { error } = await sb.from("submissions").insert({
    kind: draft.kind,
    message: draft.message,
    name: draft.name,
    contact: draft.contact,
    payload: draft.payload,
  });
  if (error) throw error;
}

export async function fetchSubmissions(
  sb: SupabaseClient,
  status: "pending" | "all" = "pending",
): Promise<Submission[]> {
  let q = sb
    .from("submissions")
    .select("id,kind,message,name,contact,payload,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status === "pending") q = q.eq("status", "pending");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Submission[];
}

export async function reviewSubmission(
  sb: SupabaseClient,
  id: string,
  action: "approved" | "rejected",
): Promise<void> {
  const { error } = await sb.from("submissions").update({ status: action }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Volunteer requests
// ---------------------------------------------------------------------------

export interface VolunteerRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profile: string | null;
  motivation: string | null;
  region: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface VolunteerRequestDraft {
  name: string;
  email: string;
  phone: string | null;
  profile: string | null;
  motivation: string | null;
  region: string | null;
}

export async function createVolunteerRequest(
  sb: SupabaseClient,
  draft: VolunteerRequestDraft,
): Promise<void> {
  const { error } = await sb.from("volunteer_requests").insert(draft);
  if (error) throw error;
}

export async function fetchVolunteerRequests(
  sb: SupabaseClient,
  status: "pending" | "all" = "pending",
): Promise<VolunteerRequest[]> {
  let q = sb
    .from("volunteer_requests")
    .select("id,name,email,phone,profile,motivation,region,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status === "pending") q = q.eq("status", "pending");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as VolunteerRequest[];
}

/**
 * Marks the request reviewed. It does NOT create the account: that needs the service
 * role and therefore a server route (`/api/staff/volunteers`), which checks the caller
 * is an admin before touching it.
 *
 * ⚠️ That route is the missing half of onboarding, and its absence is silent: approving
 * here flips a status and nothing else happens — no account, and no email, even though
 * the welcome template is written and waiting (`sendVolunteerWelcome` in
 * `src/lib/email.ts`). The first deployment shipped exactly this gap for weeks and
 * volunteers ended up with access and no instructions. Until the route exists, whoever
 * approves has to create the user in Supabase and send the manual link by hand.
 */
export async function reviewVolunteerRequest(
  sb: SupabaseClient,
  id: string,
  action: "approved" | "rejected",
): Promise<void> {
  const { error } = await sb.from("volunteer_requests").update({ status: action }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export async function fetchAudit(sb: SupabaseClient, limit = 120): Promise<AuditEntry[]> {
  const { data, error } = await sb
    .from("audit_log")
    .select("id,action,entity,entity_id,summary,actor_email,actor_role,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  // Pre-migration deployments simply have no feed; that is not an error worth showing.
  if (error) return [];
  return (data ?? []) as unknown as AuditEntry[];
}

/** Counts for the badge on the staff button. Cheap enough to poll. */
export async function fetchPendingCounts(
  sb: SupabaseClient,
): Promise<{ submissions: number; volunteers: number }> {
  const [subs, vols] = await Promise.all([
    sb.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb
      .from("volunteer_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  return { submissions: subs.count ?? 0, volunteers: vols.count ?? 0 };
}
