import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * "Is the caller staff, and who are they?"
 *
 * Shared rather than copied per route: this is the check that stands in front of the
 * service role, and two copies of an authorisation rule drift. Every staff route verifies
 * the CALLER with their own cookie-bound session first, and only then reaches for
 * anything privileged.
 *
 * This is a gate, not the only gate. RLS refuses the reads and writes regardless.
 */
export interface StaffGate {
  /** The caller's own client — RLS and the audit trigger still apply through it. */
  sb: SupabaseClient;
  uid: string;
  email: string | null;
  role: "admin" | "volunteer";
}

export function isGate(value: StaffGate | NextResponse): value is StaffGate {
  return !(value instanceof NextResponse);
}

async function gate(required: "admin" | "staff"): Promise<StaffGate | NextResponse> {
  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await sb
    .from("staff_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = data?.role;
  if (role !== "admin" && role !== "volunteer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (required === "admin" && role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return { sb, uid: user.id, email: user.email ?? null, role };
}

/** Admin only. */
export const requireAdmin = () => gate("admin");

/** Any signed-in staff member. */
export const requireStaff = () => gate("staff");
