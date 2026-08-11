import { NextResponse } from "next/server";
import { emailStatus, sendTestEmail } from "@/lib/email";
import { isGate, requireAdmin } from "@/lib/staffGate";

/**
 * Is outbound mail actually working? Admin only.
 *
 *   GET   what the mail module is configured with (names and masked addresses only)
 *   POST  connect, authenticate and send one test message to the CALLER's own address
 *
 * This exists because every send in `src/lib/email.ts` is best-effort and returns a bare
 * boolean, so "SMTP was never configured on this host" and "the mail went out and got
 * dropped" are indistinguishable from the outside — and on a host whose logs you cannot
 * read, that is the difference between a five-minute fix and an afternoon.
 *
 * Two deliberate limits:
 *
 *   • It reports env var NAMES and masked addresses. Never a password, never a full
 *     address. An admin session is not a reason to hand out credentials.
 *   • POST mails the signed-in admin's own address and takes no recipient parameter. An
 *     authenticated endpoint that mails anywhere on request is a spam relay with a
 *     diagnostic's name on it.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdmin();
  if (!isGate(gate)) return gate;
  return NextResponse.json(emailStatus());
}

export async function POST() {
  const gate = await requireAdmin();
  if (!isGate(gate)) return gate;

  if (!gate.email) {
    return NextResponse.json({ error: "no_address_on_session" }, { status: 422 });
  }

  const result = await sendTestEmail(gate.email);
  return NextResponse.json(
    { ...result, sentTo: gate.email, status: emailStatus() },
    // 200 either way: the request succeeded, the SEND is what did or did not. A 500 here
    // would make a working diagnostic look like a broken endpoint.
    { status: 200 },
  );
}
