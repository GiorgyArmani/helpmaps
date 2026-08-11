import { NextResponse } from "next/server";
import { isGate, requireStaff } from "@/lib/staffGate";
import { passwordTooShort, MIN_PASSWORD } from "@/lib/password";
import { isPwnedPassword } from "@/lib/passwordBreach";

/**
 * Change your own staff password.
 *
 *   POST { password }
 *
 * Takes no user id, and never will. The update runs through the CALLER's own
 * cookie-bound session, so the only account it can possibly change is theirs — there is
 * no service role in this path and therefore no way to aim it at somebody else.
 *
 * It goes through the server rather than calling `supabase.auth.updateUser` straight from
 * the panel because the policy has two halves: the length rule (`src/lib/password.ts`,
 * client-safe) and the breach check (`src/lib/passwordBreach.ts`, server only). A
 * password set from the panel has to clear the same bar as one an admin provisions —
 * both open the same door onto a live map.
 *
 * Any staff member, not just admins: a volunteer who cannot change the temporary
 * password they were emailed will keep using it forever.
 */
export async function POST(req: Request) {
  const gate = await requireStaff();
  if (!isGate(gate)) return gate;

  let password = "";
  try {
    const raw: unknown = await req.json();
    if (raw && typeof raw === "object" && "password" in raw) {
      const value = (raw as { password: unknown }).password;
      password = typeof value === "string" ? value : "";
    }
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (passwordTooShort(password)) {
    return NextResponse.json({ error: "password_too_short", min: MIN_PASSWORD }, { status: 422 });
  }
  if (await isPwnedPassword(password)) {
    return NextResponse.json({ error: "pwned_password" }, { status: 422 });
  }

  const { error } = await gate.sb.auth.updateUser({ password });
  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
