"use client";

import { useState } from "react";
import { MIN_PASSWORD, passwordTooShort } from "@/lib/password";
import { Button, Field, Input, Notice } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";

/**
 * Change your own password, from inside the panel.
 *
 * Every account here starts on a password somebody else generated and emailed. Without
 * this there is no way to move off it — which is the same as saying the credential in
 * that inbox stays valid forever, on an account that publishes live to the map.
 *
 * Collapsed by default: it is a thing you do once, not a thing you read every day.
 */
export default function PasswordChange() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && passwordTooShort(password);
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = !passwordTooShort(password) && password === confirm && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The breach check is the one rejection worth explaining: "too short" is already
        // visible as you type, but "this one has leaked" is not guessable.
        setError(
          data.error === "pwned_password"
            ? t("password.pwned")
            : data.error === "password_too_short"
              ? t("password.tooShort", { n: MIN_PASSWORD })
              : t("admin.saveError"),
        );
        return;
      }
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch {
      setError(t("error.network"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="linkbtn" onClick={() => setOpen(true)}>
        {t("password.change")}
      </button>
    );
  }

  return (
    <form className="form pwform" onSubmit={submit}>
      <Field label={t("password.new")} hint={t("password.hint", { n: MIN_PASSWORD })}>
        <Input
          required
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setDone(false);
          }}
        />
      </Field>
      <Field label={t("password.confirm")}>
        <Input
          required
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>

      {tooShort ? <p className="lerr">{t("password.tooShort", { n: MIN_PASSWORD })}</p> : null}
      {mismatch ? <p className="lerr">{t("password.mismatch")}</p> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {done ? <Notice tone="info">{t("password.done")}</Notice> : null}

      <div className="wrapline">
        <Button type="submit" loading={busy} disabled={!canSubmit}>
          {busy ? t("common.saving") : t("password.save")}
        </Button>
        <button type="button" className="linkbtn" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
