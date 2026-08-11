"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { MIN_PASSWORD, passwordTooShort } from "@/lib/password";
import { Button, Field, Input, Notice, Spinner } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";
import { BRAND } from "@/config";

type Phase = "checking" | "ready" | "invalid" | "done";

/**
 * Where the emailed "create my password" link lands.
 *
 * The link is a Supabase recovery link minted server-side by `generateLink` and delivered
 * through this deployment's own SMTP. Following it establishes a session, and this page
 * is the form that spends it.
 *
 * It has to cope with BOTH shapes Supabase can hand back, because which one you get
 * depends on the project's flow setting and neither is under this page's control:
 *
 *   • `?code=…`  — PKCE. Exchange it for a session.
 *   • `#access_token=…` — implicit. The browser client consumes it on construction
 *     (`detectSessionInUrl`), so the session may already exist before this runs.
 *
 * Rather than guess, it tries the exchange when a code is present and then simply asks
 * whether there is a session, listening for `PASSWORD_RECOVERY` in case the client is
 * still parsing the fragment.
 */
export default function ResetPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    let cancelled = false;

    // A session arriving from the URL fragment can land after this effect runs.
    const sub = sb?.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setPhase("ready");
    });

    // Every state change below happens after an await, so this never cascades renders
    // the way the rule guards against.
    void (async () => {
      if (!sb) {
        setPhase("invalid");
        return;
      }
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeErr } = await sb.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeErr) {
          setPhase("invalid");
          return;
        }
      }
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      setPhase(data.session ? "ready" : "invalid");
    })();

    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (passwordTooShort(password) || password !== confirm || busy) return;
      setBusy(true);
      setError(null);
      try {
        // The shared endpoint, so a password set here clears the same policy — length
        // AND the breach check — as one set anywhere else.
        const res = await fetch("/api/staff/password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data: { error?: string } = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            data.error === "pwned_password"
              ? t("password.pwned")
              : data.error === "password_too_short"
                ? t("password.tooShort", { n: MIN_PASSWORD })
                : t("admin.saveError"),
          );
          return;
        }
        setPhase("done");
        // Straight into the panel: they are already signed in by the recovery session.
        window.setTimeout(() => router.replace("/?panel=1"), 1200);
      } catch {
        setError(t("error.network"));
      } finally {
        setBusy(false);
      }
    },
    [password, confirm, busy, t, router],
  );

  const tooShort = password.length > 0 && passwordTooShort(password);
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = !passwordTooShort(password) && password === confirm && !busy;

  return (
    <main className="loginwrap">
      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>{t("reset.title")}</h1>
        <p className="small mut" style={{ marginTop: 6 }}>
          {t("reset.subtitle")}
        </p>
      </div>

      {phase === "checking" ? <Spinner /> : null}

      {phase === "invalid" ? (
        <>
          <Notice tone="danger">{t("reset.invalid")}</Notice>
          <Link className="linkbtn" href="/?panel=1">
            {t("login.title")}
          </Link>
        </>
      ) : null}

      {phase === "done" ? <Notice tone="info">{t("reset.done")}</Notice> : null}

      {phase === "ready" ? (
        <form className="form" onSubmit={submit}>
          <Field label={t("password.new")} hint={t("password.hint", { n: MIN_PASSWORD })}>
            <Input
              required
              autoFocus
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          <Button type="submit" loading={busy} disabled={!canSubmit} block>
            {busy ? t("common.saving") : t("reset.submit")}
          </Button>
        </form>
      ) : null}

      <Link className="linkbtn" href="/">
        ← {BRAND.name}
      </Link>
    </main>
  );
}
