import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ⚠️ Server only.

function creds() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

/**
 * Cookie-bound client: carries the caller's session, so RLS sees who they are. This is
 * what every staff-gated route handler uses — never the service role.
 */
export async function supabaseServer(): Promise<SupabaseClient | null> {
  const { url, key } = creds();
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The session is
          // refreshed by the route handlers instead; ignoring this is the documented
          // pattern rather than a swallowed bug.
        }
      },
    },
  });
}

/** Anonymous, session-less client for public SSR reads (share pages, sitemap, API). */
export function supabasePublic(): SupabaseClient | null {
  const { url, key } = creds();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
