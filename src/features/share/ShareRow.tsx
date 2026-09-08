"use client";

import { useState } from "react";
import type { Center } from "@/domain/types";

import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import {
  IG_FORMATS,
  centerUrl,
  copyText,
  nativeShare,
  shareCenterImage,
  shareText,
  telegramUrl,
  whatsappUrl,
} from "@/features/share/share";
import type { DictKey } from "@/i18n";
import { useSiteHelpers } from "@/features/app/SiteProvider";
import { isDigital } from "@/domain/center";
import { coverageLabel } from "@/features/centers/coverage";

/**
 * Share targets for one point.
 *
 * WhatsApp first: it is where these links actually travel. Instagram is not a link
 * target at all — it has no share-URL intent — so that button generates the banner
 * image instead, and reveals a small picker for the canvas. One button, then a choice,
 * with each option showing a rectangle at its real ratio so it reads without reading.
 */
export default function ShareRow({ center }: { center: Center }) {
  const { regionLabel } = useSiteHelpers();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [igOpen, setIgOpen] = useState(false);
  const [building, setBuilding] = useState(false);

  const text = shareText(center, {
    typeLabel: t(`type.${center.type}` as DictKey),
    place: isDigital(center)
      ? coverageLabel(center, regionLabel, t)
      : center.municipality ?? regionLabel(center.region),
    needTemplate: t("share.needText", { name: "{name}", needs: "{needs}" }),
    pointTemplate: t("share.pointText", { name: "{name}", type: "{type}", place: "{place}" }),
  });
  const url = centerUrl(center.id);

  async function copy() {
    if (await copyText(url)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <div className="targets">
        <button
          type="button"
          className="tgt"
          onClick={() => window.open(whatsappUrl(text), "_blank", "noopener")}
        >
          <span className="ti ti-wa">
            <Icon.whatsapp width={16} height={16} />
          </span>
          WhatsApp
        </button>

        <button
          type="button"
          className="tgt"
          onClick={() => window.open(telegramUrl(url, text), "_blank", "noopener")}
        >
          <span className="ti ti-tg">
            <Icon.share width={16} height={16} />
          </span>
          Telegram
        </button>

        <button type="button" className="tgt" onClick={() => setIgOpen((v) => !v)}>
          <span className="ti ti-ig">
            <Icon.spark width={16} height={16} />
          </span>
          {t("share.image")}
        </button>

        <button type="button" className="tgt" onClick={() => void copy()}>
          <span className="ti ti-cp">
            <Icon.link width={16} height={16} />
          </span>
          {copied ? t("share.linkCopied") : t("share.copyLink")}
        </button>

        {/* La hoja del sistema alcanza TODAS las apps que tenga la persona, incluidas las
            que no publican un enlace para compartir. Va aquí dentro, como una baldosa más:
            suelto debajo de la fila y con estilo de enlace se leía como el pie de la
            sección —un rótulo «Compartir» repetido bajo un bloque que ya se titula
            «Compartir»— y nadie iba a tocar lo que parece un título. */}
        <button
          type="button"
          className="tgt"
          onClick={() => void nativeShare(center.name, text, url)}
        >
          <span className="ti ti-os">
            <Icon.share width={16} height={16} />
          </span>
          {t("share.more")}
        </button>
      </div>

      {igOpen ? (
        <div className="igpick">
          <span className="igpick-t">{building ? t("share.building") : t("share.igTitle")}</span>
          <div className="igpick-row">
            {IG_FORMATS.map((f) => (
              <button
                key={f.fmt}
                type="button"
                className="igpick-b"
                disabled={building}
                onClick={async () => {
                  setBuilding(true);
                  await shareCenterImage(center.id, center.name, f.fmt);
                  setBuilding(false);
                  setIgOpen(false);
                }}
              >
                <span className="igpick-r" style={{ width: f.w, height: f.h }} />
                {t(f.key)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

    </>
  );
}
