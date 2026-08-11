"use client";

import { useState } from "react";
import { COUNTRY } from "@/config";
import { Button, Field, Input, Notice, Select, TextArea } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";
import PrivacyNotice from "@/features/suggest/PrivacyNotice";

/**
 * "Join the team".
 *
 * Panel access means publishing live onto a map people act on, so this creates a request
 * an admin reviews — never an account. The account is created afterwards, from the
 * panel, by a route that checks the caller is an admin first.
 */
export default function VolunteerForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    profile: "",
    region: "",
    motivation: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error" | "limited">("idle");

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/volunteers/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.status === 429) {
        setState("limited");
        return;
      }
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="stack" style={{ paddingBottom: 24 }}>
        <p className="lok">
          <strong>{t("volunteer.done")}</strong>
          <br />
          {t("volunteer.doneBody")}
        </p>
        <Button variant="secondary" onClick={onDone}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit} style={{ paddingBottom: 24 }}>
      <p className="small mut">{t("volunteer.subtitle")}</p>

      <Field label={t("volunteer.name")}>
        <Input required value={form.name} maxLength={80} onChange={set("name")} />
      </Field>

      <Field label={t("volunteer.email")}>
        <Input required type="email" value={form.email} maxLength={120} onChange={set("email")} />
      </Field>

      <Field label={t("volunteer.phone")} optional optionalLabel={t("common.optional")}>
        <Input value={form.phone} maxLength={24} inputMode="tel" onChange={set("phone")} />
      </Field>

      <Field label={t("volunteer.profile")} hint={t("volunteer.profileHint")}>
        <Input value={form.profile} maxLength={120} onChange={set("profile")} />
      </Field>

      <Field label={t("volunteer.region")} optional optionalLabel={t("common.optional")}>
        <Select value={form.region} onChange={set("region")}>
          <option value="">—</option>
          {COUNTRY.regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t("volunteer.motivation")}>
        <TextArea value={form.motivation} maxLength={1200} onChange={set("motivation")} />
      </Field>

      <PrivacyNotice />

      {state === "error" ? <Notice tone="danger">{t("suggest.error")}</Notice> : null}
      {state === "limited" ? <Notice tone="warn">{t("suggest.tooMany")}</Notice> : null}

      <Button type="submit" loading={state === "sending"} disabled={!form.name || !form.email}>
        {state === "sending" ? t("suggest.sending") : t("volunteer.submit")}
      </Button>
    </form>
  );
}
