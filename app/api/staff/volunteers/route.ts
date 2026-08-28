import { NextResponse } from "next/server";
import { isGate, requireAdmin, type StaffGate } from "@/lib/staffGate";
import { absoluteUrl } from "@/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendVolunteerWelcome } from "@/lib/email";
import { passwordTooShort } from "@/lib/password";
import { isPwnedPassword } from "@/lib/passwordBreach";
import { cleanName, isEmail } from "@/lib/sanitize";

/**
 * Staff accounts. Admin only.
 *
 *   POST   { email, name?, password? }        create a volunteer account + welcome email
 *   PATCH  { id, action: approve|reject }     resolve a pending volunteer request
 *   GET                                       list the team
 *   DELETE { user_id }                        revoke a volunteer
 *
 * WHY THIS ROUTE EXISTS AT ALL: creating an auth user needs the service role, and the
 * service role bypasses RLS completely. So the shape is always the same — verify the
 * CALLER first with their own cookie-bound session, and only then reach for it.
 *
 * The service role is used for exactly one thing here: `auth.admin.*`. Every table write
 * (the role row, the request status) goes through the caller's session, so RLS and the
 * `volunteer_requests` guard trigger still apply and the audit log records a real person
 * instead of "system". That trigger, in fact, REJECTS a service-role update: it demands
 * `is_admin()`, and the service role has no `auth.uid()`. Using the caller's client is
 * not only tidier, it is the only thing that works.
 *
 * Approving is what closes the loop the first deployment left open for weeks: it creates
 * the account, grants the role AND sends the welcome with the manual. If the mail fails,
 * the temporary password comes back in the response so the admin can hand it over by
 * WhatsApp — until SPF/DKIM/DMARC are configured that is not a rare case.
 */

async function body(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await req.json();
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return null;
  }
}

/**
 * How long the emailed link is good for, in hours. Informational only — the real expiry
 * is Supabase's `MAILER_OTP_EXP` setting; this is what the copy tells the person. Keep
 * them in step if you change it there.
 */
const RECOVERY_HOURS = 24;

/**
 * A single-use link that lets somebody set their own password.
 *
 * `generateLink` MINTS the link without sending anything: Supabase's own mailer is not
 * involved, so the message goes out through this deployment's SMTP with the rest of the
 * product's email, in the product's own template and language.
 *
 * Returns null rather than throwing. A missing link degrades the welcome to "sign in with
 * the password you have", which is wrong but harmless; failing the whole approval because
 * a link could not be minted would leave a volunteer approved in the queue with no
 * account behind them.
 */
async function recoveryLink(email: string): Promise<string | null> {
  const admin = supabaseAdmin();
  if (!admin) return null;
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: absoluteUrl("/reset") },
    });
    if (error) {
      console.error("[staff] generateLink failed:", error.message);
      return null;
    }
    return data.properties?.action_link ?? null;
  } catch (err) {
    console.error("[staff] generateLink threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

interface Provisioned {
  ok: true;
  user_id: string;
  emailed: boolean;
  /**
   * The set-password link, returned ONLY when the email did not go out — so an admin can
   * pass it on another way instead of the person being stranded. It is single-use and
   * short-lived, which is the whole reason it is safe to hand over at all; the generated
   * password it replaces was neither.
   */
  setPasswordUrl?: string;
}

/**
 * Create the auth user, grant the volunteer role, send the welcome. Shared by POST and
 * by approving a request.
 *
 * The auth user is deleted again if the role insert fails: an account with no role can
 * sign in and see nothing, which looks to the person like being rejected after being
 * told they were accepted.
 */
async function provision(
  gate: StaffGate,
  input: { email: string; name?: string | null; password?: string },
): Promise<Provisioned | NextResponse> {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  // An admin may still set a password directly (handing it over in person). Omitted —
  // the normal path — the account is created WITHOUT one and the person sets their own
  // from the emailed link, so no credential is ever generated on their behalf.
  const chosen = typeof input.password === "string" && input.password ? input.password : null;
  if (chosen) {
    // Same floor as any other door into this building: an admin-issued password grants
    // the same live-publish capability.
    if (passwordTooShort(chosen)) {
      return NextResponse.json({ error: "password_too_short" }, { status: 422 });
    }
    if (await isPwnedPassword(chosen)) {
      return NextResponse.json({ error: "pwned_password" }, { status: 422 });
    }
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    ...(chosen ? { password: chosen } : {}),
    // No confirmation round trip: the welcome email is already the round trip, and a
    // volunteer blocked behind an unconfirmed address is a volunteer who never starts.
    email_confirm: true,
  });
  if (createErr || !created.user) {
    const already = /already|registered|exists/i.test(createErr?.message ?? "");
    return NextResponse.json(
      { error: already ? "email_taken" : "create_failed", detail: createErr?.message },
      { status: already ? 409 : 400 },
    );
  }

  const { error: roleErr } = await gate.sb
    .from("staff_users")
    .insert({ user_id: created.user.id, role: "volunteer", email: input.email });
  if (roleErr) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return NextResponse.json({ error: "role_failed", detail: roleErr.message }, { status: 400 });
  }

  const setPasswordUrl = await recoveryLink(input.email);

  const emailed = await sendVolunteerWelcome({
    to: input.email,
    name: input.name ?? undefined,
    setPasswordUrl: setPasswordUrl ?? undefined,
    setPasswordHours: RECOVERY_HOURS,
  }).catch(() => false);

  // Only when the mail did not go out — otherwise the link lives in exactly one place,
  // the recipient's inbox, rather than also in an admin's screen and browser history.
  return {
    ok: true,
    user_id: created.user.id,
    emailed,
    ...(emailed || !setPasswordUrl ? {} : { setPasswordUrl }),
  };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!isGate(gate)) return gate;

  const raw = await body(req);
  if (!raw) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!isEmail(email)) return NextResponse.json({ error: "invalid_email" }, { status: 422 });

  const result = await provision(gate, {
    email,
    name: cleanName(raw.name, 80) || null,
    password: typeof raw.password === "string" ? raw.password : undefined,
  });
  if (!isProvisioned(result)) return result;
  return NextResponse.json(result);
}

function isProvisioned(value: Provisioned | NextResponse): value is Provisioned {
  return !(value instanceof NextResponse);
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (!isGate(gate)) return gate;

  const raw = await body(req);
  if (!raw) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const id = typeof raw.id === "string" ? raw.id : "";
  const action = raw.action === "approve" || raw.action === "reject" ? raw.action : null;
  if (!id || !action) return NextResponse.json({ error: "invalid_input" }, { status: 422 });

  const { data: request, error } = await gate.sb
    .from("volunteer_requests")
    .select("id,name,email,status")
    .eq("id", id)
    .maybeSingle();
  if (error || !request) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
  }

  if (action === "reject") {
    // Nothing to undo: this deployment's signup form creates no account, it only asks.
    const { error: updErr } = await gate.sb
      .from("volunteer_requests")
      .update({ status: "rejected" })
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: "update_failed" }, { status: 400 });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const email = String(request.email ?? "").trim().toLowerCase();
  if (!isEmail(email)) return NextResponse.json({ error: "invalid_email" }, { status: 422 });

  const result = await provision(gate, { email, name: request.name as string | null });
  if (!isProvisioned(result)) return result;

  // Marked approved only after the account exists: a request marked approved with no
  // account behind it is invisible — it leaves the queue and nobody ever gets access.
  const { error: updErr } = await gate.sb
    .from("volunteer_requests")
    .update({ status: "approved" })
    .eq("id", id);
  if (updErr) {
    // The account is real and the welcome is sent; only the queue row is stale. Say so
    // rather than pretending the whole thing failed and inviting a second attempt.
    return NextResponse.json(
      { ...result, status: "approved", requestStale: true },
      { status: 207 },
    );
  }

  return NextResponse.json({ ...result, status: "approved" });
}

export async function GET() {
  const gate = await requireAdmin();
  if (!isGate(gate)) return gate;

  // `staff_users` carries the email, so listing the team needs no service-role call into
  // the auth schema at all.
  const { data, error } = await gate.sb
    .from("staff_users")
    .select("user_id,role,email,created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "list_failed" }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}

/**
 * Re-send the onboarding email to somebody who already has access.
 *
 *   PUT { user_id }
 *
 * The gap this closes: the welcome is only ever sent by `provision()`, so an account
 * created any OTHER way never gets one — and the documented way to bootstrap the first
 * account (db/01_esquema.sql § 002_staff) is a hand-written `insert into staff_users`, which no
 * trigger watches because the database sends no mail at all. Same for anyone whose
 * welcome bounced while SMTP was misconfigured.
 *
 * Sends the no-credential variant deliberately: we cannot recover their existing
 * password, and resetting it to re-send an email would lock out a volunteer who was
 * working fine. They get the login link and the manuals.
 *
 * NOTE: this deployment has no password-recovery flow yet, so somebody who has lost their
 * password cannot get back in on their own — an admin has to re-provision them through
 * POST. Until `resetPasswordForEmail` and a `/reset` page exist, that is the only route
 * back, and this endpoint is not it.
 */
export async function PUT(req: Request) {
  const gate = await requireAdmin();
  if (!isGate(gate)) return gate;

  const raw = await body(req);
  if (!raw) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const userId = typeof raw.user_id === "string" ? raw.user_id : "";
  if (!userId) return NextResponse.json({ error: "invalid_input" }, { status: 422 });

  // Read the address from `staff_users` through the CALLER's session, so RLS applies and
  // this cannot be used to enumerate auth records.
  const { data: target } = await gate.sb
    .from("staff_users")
    .select("email,role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target?.email) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // A fresh link every time: the previous one is single-use and may well be why they
  // are asking for another.
  const setPasswordUrl = await recoveryLink(target.email);

  const emailed = await sendVolunteerWelcome({
    to: target.email,
    name: cleanName(raw.name, 80) || null,
    setPasswordUrl: setPasswordUrl ?? undefined,
    setPasswordHours: RECOVERY_HOURS,
  }).catch(() => false);

  // 200 with `emailed:false` rather than an error: the caller asked whether it went out,
  // and "no, and here is that fact" is a successful answer to that question.
  return NextResponse.json({ ok: true, emailed, to: target.email });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (!isGate(gate)) return gate;

  const raw = await body(req);
  if (!raw) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const userId = typeof raw.user_id === "string" ? raw.user_id : "";
  if (!userId) return NextResponse.json({ error: "invalid_input" }, { status: 422 });

  // Only ever revoke a volunteer. An admin removing another admin — or themselves — from
  // this endpoint is how a deployment ends up with nobody able to get back in.
  const { data: target } = await gate.sb
    .from("staff_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (target.role !== "volunteer") {
    return NextResponse.json({ error: "not_a_volunteer" }, { status: 409 });
  }

  const { error: delErr } = await gate.sb.from("staff_users").delete().eq("user_id", userId);
  if (delErr) return NextResponse.json({ error: "revoke_failed" }, { status: 400 });

  // Access is already gone with the role row; removing the login is the second half.
  const admin = supabaseAdmin();
  if (admin) await admin.auth.admin.deleteUser(userId).catch(() => {});

  return NextResponse.json({ ok: true });
}
