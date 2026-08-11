"use client";

import { useCallback, useEffect, useState } from "react";
import type { StaffSession } from "@/domain/types";
import { fetchStaffSession } from "@/data/staff";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export interface StaffState {
  session: StaffSession | null;
  /** False until the first lookup has finished; distinguishes "no" from "not yet". */
  checked: boolean;
  refresh: () => void;
  clear: () => void;
}

/**
 * Who is signed in, resolved LAZILY.
 *
 * `active` is what gates the lookup, and it is false for every public visitor: a staff
 * check on the critical path of the map would spend a round trip, on the one bar of
 * signal this app is designed for, answering a question almost nobody is asking. It runs
 * the first time the panel is actually opened.
 *
 * This is a courtesy to the person, not a security control. The real gate is RLS, which
 * refuses the reads and writes regardless of what this returns.
 */
export function useStaffSession(active: boolean): StaffState {
  const [session, setSession] = useState<StaffSession | null>(null);
  // Nothing to resolve when the deployment has no database yet, so that case starts
  // resolved rather than being corrected from inside the effect.
  const [checked, setChecked] = useState(() => !supabaseConfigured());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    void (async () => {
      const found = await fetchStaffSession(sb);
      if (cancelled) return;
      setSession(found);
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const clear = useCallback(() => {
    setSession(null);
    setChecked(true);
  }, []);

  return { session, checked, refresh, clear };
}
