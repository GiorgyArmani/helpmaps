"use client";

import { useState } from "react";
import type { SubmissionKind } from "@/domain/types";
import { Button, Chip, Field, Input, Notice, Select, TextArea } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";
import PrivacyNotice from "@/features/suggest/PrivacyNotice";
import { enqueue } from "@/features/suggest/offlineQueue";
import type { DictKey } from "@/i18n";
import { useSite } from "@/features/app/SiteProvider";

const KINDS: SubmissionKind[] = ["center", "initiative", "need", "other"];

/**
 * "A point is missing" / "register my initiative".
 *
 * It does NOT write the map. The submission lands in a moderation queue that the public
 * can insert into and can never read back, and a person publishes it. That gap is what
 * keeps a public form from becoming a way to put a fake address on a map that frightened
 * people are trusting.
 */
export default function SuggestForm({
  onDone,
  defaultKind = "center",
}: {
  onDone: () => void;
  defaultKind?: SubmissionKind;
}) {
  const { t } = useI18n();
  const site = useSite();
  const [kind, setKind] = useState<SubmissionKind>(defaultKind);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  // An initiative with no seat: instead of an address it declares where it helps and
  // how to reach it. These travel in `payload` and stay hints — the staff form is what
  // publishes them, after someone has read the message.
  const [hasSeat, setHasSeat] = useState(true);
  const [coverage, setCoverage] = useState<string[]>([]);
  const [municipalities, setMunicipalities] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const digital = kind === "initiative" && !hasSeat;
  const [state, setState] = useState<
    "idle" | "sending" | "done" | "queued" | "error" | "limited"
  >("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || state === "sending") return;
    setState("sending");
    const payload = digital
      ? {
          digital: true,
          coverage_regions: coverage,
          coverage_municipalities: municipalities
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          website: website.trim(),
          instagram: instagram.trim(),
          whatsapp: whatsapp.trim(),
        }
      : null;
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, message, name, contact, payload }),
      });
      if (res.status === 429) {
        setState("limited");
        return;
      }
      setState(res.ok ? "done" : "error");
    } catch {
      // The network died mid-send. Keep what they typed and retry when the signal is
      // back: someone standing in front of a shelter on one bar may be the only person
      // who was ever going to report it.
      enqueue({ kind, message, name: name || null, contact: contact || null, payload });
      setState("queued");
    }
  }

  if (state === "done" || state === "queued") {
    return (
      <div className="stack" style={{ paddingBottom: 24 }}>
        <p className="lok">
          <strong>{t("suggest.done")}</strong>
          <br />
          {state === "queued" ? t("offline.queued") : t("suggest.doneBody")}
        </p>
        <Button variant="secondary" onClick={onDone}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit} style={{ paddingBottom: 24 }}>
      <p className="small mut">{t("suggest.subtitle")}</p>

      <Field label={t("suggest.kind")}>
        <Select value={kind} onChange={(e) => setKind(e.target.value as SubmissionKind)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`suggest.kind.${k}` as DictKey)}
            </option>
          ))}
        </Select>
      </Field>

      {kind === "initiative" ? (
        <Field label={t("form.hasSeat")} hint={t("form.hasSeatHint")}>
          <div className="seg">
            <button
              type="button"
              className={`segb${hasSeat ? " segb-on" : ""}`}
              aria-pressed={hasSeat}
              onClick={() => setHasSeat(true)}
            >
              {t("common.yes")}
            </button>
            <button
              type="button"
              className={`segb${!hasSeat ? " segb-on" : ""}`}
              aria-pressed={!hasSeat}
              onClick={() => setHasSeat(false)}
            >
              {t("common.no")}
            </button>
          </div>
        </Field>
      ) : null}

      {digital ? (
        <>
          <Field
            label={t("form.coverage", { regions: site.country.regionNoun.many })}
            hint={t("form.coverageHint")}
          >
            <div className="covpick">
              {site.country.regions.map((r) => (
                <Chip
                  key={r.code}
                  on={coverage.includes(r.code)}
                  onClick={() =>
                    setCoverage((list) =>
                      list.includes(r.code) ? list.filter((x) => x !== r.code) : [...list, r.code],
                    )
                  }
                >
                  {r.name}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label={t("form.coverageMunicipalities")} optional optionalLabel={t("common.optional")}>
            <Input value={municipalities} maxLength={400} onChange={(e) => setMunicipalities(e.target.value)} />
          </Field>
          <Field label={t("form.website")} optional optionalLabel={t("common.optional")}>
            <Input value={website} maxLength={200} inputMode="url" onChange={(e) => setWebsite(e.target.value)} />
          </Field>
          <Field label={t("form.instagram")} optional optionalLabel={t("common.optional")}>
            <Input value={instagram} maxLength={40} onChange={(e) => setInstagram(e.target.value)} />
          </Field>
          <Field label={t("form.whatsapp")} optional optionalLabel={t("common.optional")}>
            <Input value={whatsapp} maxLength={24} inputMode="tel" onChange={(e) => setWhatsapp(e.target.value)} />
          </Field>
        </>
      ) : null}

      <Field label={t("suggest.message")}>
        <TextArea
          required
          value={message}
          maxLength={2000}
          placeholder={t("suggest.messagePlaceholder")}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>

      <Field label={t("suggest.name")} optional optionalLabel={t("common.optional")}>
        <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field
        label={t("suggest.contact")}
        hint={t("suggest.contactHint")}
        optional
        optionalLabel={t("common.optional")}
      >
        <Input value={contact} maxLength={120} onChange={(e) => setContact(e.target.value)} />
      </Field>

      <PrivacyNotice />

      {state === "error" ? <Notice tone="danger">{t("suggest.error")}</Notice> : null}
      {state === "limited" ? <Notice tone="warn">{t("suggest.tooMany")}</Notice> : null}

      <Button type="submit" loading={state === "sending"} disabled={!message.trim()}>
        {state === "sending" ? t("suggest.sending") : t("suggest.submit")}
      </Button>
    </form>
  );
}
