"use client";

import { useI18n } from "@/i18n/context";
import { Icon } from "@/ui/icons";
import type { Center } from "@/domain/types";
import { isVerified } from "@/domain/verification";

/**
 * El sello «Verificada».
 *
 * Dos tamaños: `full` lleva la palabra (la cabecera de un perfil, donde hay sitio y es la
 * primera vez que alguien lo ve) y `icon` sólo el distintivo, para una fila de lista o una
 * tarjeta del feed, donde la palabra empujaría el nombre a dos líneas. El icono nunca va
 * mudo: lleva su nombre para el lector de pantalla y en el `title`.
 *
 * No se pinta nada si el sello no está vigente. Un «verificación vencida» en público se
 * leería como una acusación; eso es asunto de la cola del equipo, no de la ficha.
 */
export default function VerifiedSeal({ center, size = "full" }: { center: Center; size?: "full" | "icon" }) {
  const { t } = useI18n();
  if (!isVerified(center)) return null;

  if (size === "icon") {
    return (
      <span className="vseal vseal-icon" role="img" aria-label={t("verify.seal")} title={t("verify.sealHint")}>
        <Icon.verified />
      </span>
    );
  }
  return (
    <span className="vseal" title={t("verify.sealHint")}>
      <Icon.verified />
      {t("verify.seal")}
    </span>
  );
}
