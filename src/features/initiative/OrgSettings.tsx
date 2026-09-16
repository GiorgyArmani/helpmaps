"use client";

import { useState } from "react";
import type { Center } from "@/domain/types";
import type { DonationClaim } from "@/data/initiatives";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";

/**
 * La configuración de la organización: lo que no es contenido del perfil.
 *
 * El perfil es lo que se enseña; esto es con lo que se trabaja. Separarlo es lo que deja
 * que la página se lea como una página y no como un panel de control: los aportes por
 * confirmar, el QR y el enlace son herramientas del gestor, y el público nunca las ve.
 */
export default function OrgSettings({
  center,
  claims,
  onResolve,
  onBack,
}: {
  center: Center;
  claims: DonationClaim[];
  onResolve: (id: string, status: "confirmed" | "rejected") => void;
  onBack: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="pedit">
      <div className="pedit-bar">
        <button type="button" className="pedit-back" onClick={onBack} aria-label={t("org.back")}>
          <Icon.back />
        </button>
        <h2 className="pedit-bar-title">{t("org.title")}</h2>
      </div>

      <p className="pedit-bar-sub">{center.name}</p>

      {/* Primero lo que tiene a alguien esperando. */}
      <section className="ecard">
        <div className="ecard-head">
          <h3 className="ecard-title">{t("org.claimsTitle")}</h3>
          {claims.length > 0 ? <span className="pedit-count">{claims.length}</span> : null}
        </div>
        {claims.length === 0 ? (
          <p className="pedit-none">{t("org.claimsNone")}</p>
        ) : (
          <>
            <p className="fhint">{t("claims.hint")}</p>
            {claims.map((c) => (
              <article key={c.id} className="claim">
                <span className="claim-who">
                  <b>{c.donor_name ?? t("account.noName")}</b>
                  {c.note ? <span className="claim-note">{c.note}</span> : null}
                </span>
                <span className="claim-acts">
                  <button type="button" className="claim-yes" onClick={() => onResolve(c.id, "confirmed")}>
                    {t("claims.confirm")}
                  </button>
                  <button type="button" className="claim-no" onClick={() => onResolve(c.id, "rejected")}>
                    {t("claims.reject")}
                  </button>
                </span>
              </article>
            ))}
          </>
        )}
      </section>

      {/* El QR de reconocimiento. Todavía sin código detrás, y por eso sin QR: enseñar uno
          que no suma nada sería prometerle a un voluntario algo que no va a pasar. */}
      <section className="ecard">
        <div className="ecard-head">
          <h3 className="ecard-title">
            <Icon.qr />
            {t("org.qrTitle")}
          </h3>
          <span className="org-soon">{t("org.soon")}</span>
        </div>
        <p className="ecard-text">{t("org.qrBody")}</p>
      </section>

      <ShareCard center={center} />
    </div>
  );
}

function ShareCard({ center }: { center: Center }) {
  const { t } = useI18n();
  const [copiado, setCopiado] = useState(false);
  const url = typeof window === "undefined" ? `/c/${center.id}` : `${window.location.origin}/c/${center.id}`;
  const puedeCompartir = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles el enlace sigue a la vista y se puede seleccionar.
    }
  }

  return (
    <section className="ecard">
      <div className="ecard-head">
        <h3 className="ecard-title">{t("org.linkTitle")}</h3>
      </div>
      <p className="ecard-text">{t("org.linkBody")}</p>
      <p className="org-url">{url.replace(/^https?:\/\//, "")}</p>
      <div className="ecard-acts">
        <button type="button" className="btng" onClick={() => void copiar()}>
          <Icon.link />
          {copiado ? t("common.copied") : t("org.copyLink")}
        </button>
        {puedeCompartir ? (
          <button
            type="button"
            className="btng"
            onClick={() => void navigator.share({ title: center.name, url }).catch(() => {})}
          >
            <Icon.share />
            {t("org.share")}
          </button>
        ) : (
          <a className="btng" href={`/c/${center.id}`} target="_blank" rel="noopener noreferrer">
            <Icon.eye />
            {t("org.openPublic")}
          </a>
        )}
      </div>
    </section>
  );
}
