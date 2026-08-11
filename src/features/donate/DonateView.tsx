"use client";

import { useState } from "react";
import type { Donation } from "@/domain/types";
import { Button } from "@/ui/primitives";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { copyText } from "@/features/share/share";

/**
 * The donations directory.
 *
 * The map answers "where do I go"; this answers "where does money go", which is the
 * other half of what people ask in the first days and the one the map cannot show — an
 * organisation is not a place to travel to.
 *
 * Two decisions worth keeping:
 *
 *   • Each entry is collapsed until tapped. The account details are the point, and a
 *     screen of eight organisations' bank numbers is a screen nobody reads.
 *   • Every entry links its social or web page. This list moves money to strangers on
 *     the strength of us listing them, so the way to check them has to travel with them.
 *
 * The empty state is not a failure: it is the invitation for the first organisation.
 */
export default function DonateView({
  donations,
  onWriteToUs,
  onCopied,
}: {
  donations: Donation[];
  onWriteToUs: () => void;
  onCopied: () => void;
}) {
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="stack" style={{ paddingBottom: 24 }}>
      <p className="small mut">{t("donate.subtitle")}</p>

      <div className="donate-list">
        {donations.length === 0 ? <p className="empty">{t("donate.none")}</p> : null}

        {donations.map((d) => {
          const open = openId === d.id;
          const hasBody = Boolean(d.donate_info || d.social_url || d.donate_url);
          return (
            <div key={d.id} className={`donate-card${open ? " open" : ""}`}>
              <button
                type="button"
                className="donate-toggle"
                aria-expanded={open}
                disabled={!hasBody}
                onClick={() => setOpenId(open ? null : d.id)}
              >
                <span className="donate-info">
                  <span className="donate-name">{d.name}</span>
                  {d.description ? <span className="donate-desc">{d.description}</span> : null}
                </span>
                {hasBody ? (
                  <span className="donate-chev" aria-hidden="true">
                    <Icon.chevron style={{ transform: open ? "rotate(-90deg)" : "rotate(90deg)" }} />
                  </span>
                ) : null}
              </button>

              {open && hasBody ? (
                <div className="donate-body">
                  {d.donate_info ? (
                    <div className="donate-data">
                      <span className="donate-data-label">{t("donate.data")}</span>
                      <span className="donate-data-txt">{d.donate_info}</span>
                      <button
                        type="button"
                        className="donate-copy"
                        onClick={async () => {
                          if (await copyText(d.donate_info ?? "")) onCopied();
                        }}
                      >
                        {t("common.copy")}
                      </button>
                    </div>
                  ) : null}

                  {d.social_url || d.donate_url ? (
                    <div className="donate-acts">
                      {d.social_url ? (
                        <a
                          className="btng"
                          href={d.social_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("donate.follow")}
                        </a>
                      ) : null}
                      {d.donate_url ? (
                        <a
                          className="btnp"
                          href={d.donate_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("donate.go")}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="donate-join">
        <span className="donate-join-t">{t("donate.joinTitle")}</span>
        <span className="donate-desc">{t("donate.joinBody")}</span>
        <Button onClick={onWriteToUs}>{t("donate.joinCta")}</Button>
      </div>

      {/* Said plainly, and near the money: we are a directory, not a collector. */}
      <p className="small mut">{t("donate.note")}</p>
    </div>
  );
}
