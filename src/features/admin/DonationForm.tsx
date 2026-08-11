"use client";

import { useState } from "react";
import type { Donation } from "@/domain/types";
import type { DonationDraft } from "@/data/donations";
import { Button, Field, Input, Notice, TextArea } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";

/**
 * Add or edit an organisation in the donations directory.
 *
 * Publishing one of these tells people it is safe to send money somewhere, which is a
 * heavier claim than any other row in this panel: a wrong pin wastes a trip, a wrong
 * account number takes someone's money. Hence the standing warning, and hence the social
 * link is treated as part of the record rather than decoration — it is how a donor checks
 * us instead of trusting us.
 */
export default function DonationForm({
  donation,
  canDelete,
  onSave,
  onCancel,
  onDelete,
}: {
  donation: Donation | null;
  canDelete: boolean;
  onSave: (draft: DonationDraft) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: donation?.name ?? "",
    description: donation?.description ?? "",
    social_url: donation?.social_url ?? "",
    donate_url: donation?.donate_url ?? "",
    donate_info: donation?.donate_info ?? "",
    sort: donation ? String(donation.sort) : "0",
    active: donation?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const trimmed = (v: string) => (v.trim() ? v.trim() : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        id: donation?.id,
        name: form.name.trim(),
        description: trimmed(form.description),
        social_url: trimmed(form.social_url),
        donate_url: trimmed(form.donate_url),
        // Kept as typed, line breaks and all: it is pasted straight into a banking app.
        donate_info: form.donate_info.trim() ? form.donate_info.trim() : null,
        sort: Number.parseInt(form.sort, 10) || 0,
        active: form.active,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <Notice tone="warn">{t("form.donateWarning")}</Notice>

      <Field label={t("form.name")}>
        <Input
          required
          value={form.name}
          maxLength={120}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>

      <Field label={t("form.description")} optional optionalLabel={t("common.optional")}>
        <Input
          value={form.description}
          maxLength={200}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <Field label={t("form.socialUrl")} hint={t("form.socialUrlHintDonation")}>
        <Input
          type="url"
          value={form.social_url}
          placeholder="https://"
          onChange={(e) => set("social_url", e.target.value)}
        />
      </Field>

      <Field label={t("form.donateUrl")} optional optionalLabel={t("common.optional")}>
        <Input
          type="url"
          value={form.donate_url}
          placeholder="https://"
          onChange={(e) => set("donate_url", e.target.value)}
        />
      </Field>

      <Field label={t("form.donateInfo")} hint={t("form.donateInfoHint")} optional optionalLabel={t("common.optional")}>
        <TextArea
          value={form.donate_info}
          rows={4}
          maxLength={600}
          onChange={(e) => set("donate_info", e.target.value)}
        />
      </Field>

      <Field label={t("form.sort")} hint={t("form.sortHint")}>
        <Input
          type="number"
          value={form.sort}
          onChange={(e) => set("sort", e.target.value)}
        />
      </Field>

      <label className="fcheck">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => set("active", e.target.checked)}
        />
        <span className="fcheck-l">{t("form.activeDonation")}</span>
      </label>

      <div className="wrapline">
        <Button type="submit" loading={saving} disabled={!form.name.trim()}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
        <Button variant="ghost" type="button" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        {/* Deactivating is almost always the right move — it keeps the history. Delete
            exists for a row that should never have been published at all. */}
        {canDelete && donation && onDelete ? (
          <Button variant="danger" type="button" onClick={onDelete}>
            {t("common.delete")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
