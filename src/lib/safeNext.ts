/**
 * A dónde volver después de entrar o de crear la cuenta.
 *
 * Sólo rutas de ESTE sitio: una que empiece por `//` o por un esquema es una redirección
 * abierta, y una pantalla de acceso que manda a donde le digan es la pieza con la que se
 * monta un phishing convincente — el dominio de la barra es el bueno hasta el segundo
 * antes de dejar de serlo. La barra invertida se rechaza por lo mismo: algunos navegadores
 * leen `/\evil.com` como `//evil.com`.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (value.length > 512) return null;
  return value;
}
