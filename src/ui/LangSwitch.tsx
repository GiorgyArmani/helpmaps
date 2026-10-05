"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Lang } from "@/i18n/types";
import { useI18n } from "@/i18n/context";
import { LANG_NAME } from "@/ui/flags";

/**
 * El idioma en las portadas (`/inicio`, `/organizaciones`, `/registro`).
 *
 * Esas páginas se pintan en el servidor con el `?lang=` de la dirección, así que cambiar
 * de idioma es cambiar la dirección: queda un enlace que se puede mandar ya en ese idioma.
 * Además se guarda como en el menú del mapa (`setLang`), para que al entrar al mapa siga
 * en el mismo.
 *
 * Y al revés: quien ya eligió un idioma en el mapa y vuelve a una portada sin `?lang=` la
 * ve en el suyo, no en el de por defecto.
 *
 * `current` es el idioma con el que el servidor pintó la página; en una página que se
 * traduce en el cliente (`/registro`) no hace falta.
 */
export default function LangSwitch({ current }: { current?: Lang }) {
  const { lang: ctxLang, setLang, available, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const lang = current ?? ctxLang;

  const go = (next: Lang) => {
    setLang(next);
    const q = new URLSearchParams(params.toString());
    q.set("lang", next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  // Lo guardado (el contexto ya lo aplicó al montar) manda si la dirección no dice nada.
  useEffect(() => {
    if (current && !params.has("lang") && ctxLang !== current) go(ctxLang);
    // Sólo cuando el contexto resuelve lo guardado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxLang]);

  if (available.length < 2) return null;

  return (
    <div className="lsw" role="group" aria-label={t("account.language")}>
      {available.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          className={l === lang ? "lsw-opt lsw-on" : "lsw-opt"}
          aria-pressed={l === lang}
          aria-label={LANG_NAME[l]}
          title={LANG_NAME[l]}
          onClick={() => l !== lang && go(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
