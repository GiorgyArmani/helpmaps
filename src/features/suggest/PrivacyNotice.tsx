"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/context";

/**
 * Notice at the point of collection, on every public form.
 *
 * Plain text and a link, NOT a blocking checkbox. Someone reporting that a shelter has
 * run out of water should not have to clear a consent gate first, and consent is not
 * the lawful basis for this data anyway — it is published to help people find help.
 * Please don't "fix" this into a checkbox.
 */
export default function PrivacyNotice() {
  const { t } = useI18n();
  return (
    <p className="small mut">
      {t("privacy.notice")}{" "}
      <Link className="note-link" href="/docs/privacidad">
        {t("privacy.link")}
      </Link>
    </p>
  );
}
