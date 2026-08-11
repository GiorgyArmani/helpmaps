"use client";

import { useState } from "react";
import type { Center } from "@/domain/types";
import { regionLabel } from "@/config";
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

/**
 * Share targets for one point.
 *
 * WhatsApp first: it is where these links actually travel. Instagram is not a link
 * target at all — it has no share-URL intent — so that button generates the banner
 * image instead, and reveals a small picker for the canvas. One button, then a choice,
 * with each option showing a rectangle at its real ratio so it reads without reading.
 */
export default function ShareRow({ center }: { center: Center }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [igOpen, setIgOpen] = useState(false);
  const [building, setBuilding] = useState(false);

  const text = shareText(center, {
    typeLabel: t(`type.${center.type}` as DictKey),
    place: center.municipality ?? regionLabel(center.region),
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

      {/* The OS sheet reaches every app the person has, including the ones with no share
          URL. Offered as a secondary action because it does not exist on desktop. */}
      <button
        type="button"
        className="linkbtn"
        onClick={() => void nativeShare(center.name, text, url)}
      >
        {t("center.share")}
      </button>
    </>
  );
}
