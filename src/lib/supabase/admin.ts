import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely.
 *
 * Rules, learned the hard way on the first deployment:
 *   • Never import this from anything that can end up in the client bundle. The
 *     `server-only` import above turns a mistake into a build error, not a leak.
 *   • Every caller must verify the caller's identity FIRST with the cookie-bound client
 *     (`supabaseServer()`), and only then reach for this.
 *   • Keep the list of files that import it short enough to audit by hand.
 *
 * Today that list is:
 *   • creating and revoking staff accounts
 *   • `src/server/emergency.ts`, and ONLY on the `HELPMAPS_EMERGENCY` path — previewing a
 *     draft emergency, which RLS hides from the anon key by design. Bounded to the one
 *     slug that variable names, and no production deployment sets it.
 */
export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
