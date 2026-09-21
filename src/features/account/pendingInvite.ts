/**
 * La invitación que espera a que la persona tenga cuenta.
 *
 * ── POR QUÉ HACE FALTA, SI EL TOKEN YA VIAJA EN EL `next` ───────────────────
 *
 * Porque el `next` sólo sobrevive si Supabase respeta el `redirectTo` del enlace de
 * confirmación, y en este proyecto NO lo hace: descarta cualquier destino que no esté en
 * sus *Redirect URLs* y manda a la raíz (ver `RecoveryRedirect.tsx`). Quien confirmaba su
 * cuenta aterrizaba en el mapa, como una persona cualquiera, y la invitación se perdía.
 *
 * Así que el token se guarda también aquí, en el navegador donde se abrió la invitación,
 * y `PendingInviteRedirect` lo recupera en cuanto hay sesión, llegue donde llegue.
 *
 * No es un dato personal: es un secreto de un solo uso que ya estaba en la URL, caduca
 * solo y se borra al canjearlo.
 */
const KEY = "hm.pendingInvite";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function savePendingInvite(token: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }));
  } catch {
    // Ventana privada o almacenamiento bloqueado: queda el `next` de la URL.
  }
}

export function readPendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { token, at } = JSON.parse(raw) as { token?: unknown; at?: unknown };
    if (typeof token !== "string" || typeof at !== "number" || Date.now() - at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nada que hacer.
  }
}
