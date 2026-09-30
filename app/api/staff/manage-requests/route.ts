import { NextResponse, after } from "next/server";
import { isGate, requireStaff } from "@/lib/staffGate";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendManageDecision } from "@/lib/email";

/**
 * Resolver una solicitud de «¿Es tu organización?».
 *
 *   PATCH { id, action: approve|reject }  →  { ok, status, emailed }
 *
 * La escritura va con la sesión de quien resuelve: RLS decide si alcanza la emergencia de
 * ese punto, y al aprobar es un trigger el que deja a la persona en `center_managers`
 * (`db/15_gestion.sql`). Esta ruta no da ningún permiso por su cuenta.
 *
 * El service role se usa para UNA cosa: leer el correo de quien pidió, que el equipo no
 * puede ver, para contarle cómo terminó. Sin ese aviso, una organización aprobada no se
 * entera nunca de que ya puede entrar, y una rechazada sigue esperando.
 */
export async function PATCH(req: Request) {
  const gate = await requireStaff();
  if (!isGate(gate)) return gate;

  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    raw = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const id = typeof raw.id === "string" ? raw.id : "";
  const action = raw.action === "approve" || raw.action === "reject" ? raw.action : null;
  if (!id || !action) return NextResponse.json({ error: "invalid_input" }, { status: 422 });

  const { data: request } = await gate.sb
    .from("manage_requests")
    .select("id,user_id,status,locations(name)")
    .eq("id", id)
    .maybeSingle();
  if (!request) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
  }

  const status = action === "approve" ? "approved" : "rejected";
  const { error } = await gate.sb.from("manage_requests").update({ status }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 403 });
  }

  const loc = request.locations as { name?: string } | { name?: string }[] | null;
  const place = (Array.isArray(loc) ? loc[0]?.name : loc?.name) ?? "";

  const admin = supabaseAdmin();
  const emailed = Boolean(admin);
  if (admin) {
    after(async () => {
      const { data } = await admin.auth.admin.getUserById(String(request.user_id));
      const to = data.user?.email;
      if (to) await sendManageDecision({ to, place, approved: status === "approved" });
    });
  }

  return NextResponse.json({ ok: true, status, emailed });
}
