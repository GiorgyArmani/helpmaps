import type { SupabaseClient } from "@supabase/supabase-js";

// El boletín se lee con la anon key (política pública) y se escribe SOLO con la clave de
// servicio desde la ruta de generación: generar cuesta una llamada a un modelo de pago y
// no puede dispararlo un navegador. Ver `db/009_news.sql`.

export interface BulletinRow {
  id: string;
  generated_at: string;
  summary: string;
  sources: { id: string; name: string; count: number; error?: string }[];
  model: string | null;
}

const COLUMNS = "id,generated_at,summary,sources,model";

/**
 * The most recent bulletins, newest first.
 *
 * More than one because the entry page lets someone step back through them: what was
 * reported yesterday still matters when you have been three days without signal, and a
 * bulletin that only ever shows the latest hour is useless to exactly that person.
 */
export async function fetchBulletins(
  sb: SupabaseClient,
  emergencyId: string,
  limit = 8,
): Promise<BulletinRow[]> {
  const { data, error } = await sb
    .from("news_bulletins")
    .select(COLUMNS)
    .eq("emergency_id", emergencyId)
    .order("generated_at", { ascending: false })
    .limit(limit);
  // Una tabla que todavía no existe (migración sin correr) no puede tumbar la portada.
  if (error || !data) return [];
  return data as unknown as BulletinRow[];
}

export async function insertBulletin(
  sb: SupabaseClient,
  emergencyId: string,
  bulletin: { summary: string; model: string | null },
  sources: BulletinRow["sources"],
): Promise<void> {
  const { error } = await sb.from("news_bulletins").insert({
    emergency_id: emergencyId,
    summary: bulletin.summary,
    model: bulletin.model,
    sources,
  });
  if (error) throw error;
}

/** When the last one was written, to decide whether the cron has anything to do. */
export async function lastBulletinAt(
  sb: SupabaseClient,
  emergencyId: string,
): Promise<Date | null> {
  const { data, error } = await sb
    .from("news_bulletins")
    .select("generated_at")
    .eq("emergency_id", emergencyId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const d = new Date((data as { generated_at: string }).generated_at);
  return Number.isNaN(d.getTime()) ? null : d;
}
