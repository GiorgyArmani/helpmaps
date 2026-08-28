"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { Button, Field, Input } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";

/**
 * Team sign-in.
 *
 * A component rather than a page because the panel it leads to is a view over the map,
 * not a destination: signing in must not navigate, or the map — and everything the
 * volunteer had on screen — is torn down and rebuilt behind them.
 *
 * There is no self-service sign-up: panel access publishes live onto a map people act on,
 * so an admin provisions it.
 */
export default function LoginForm({ onSignedIn }: { onSignedIn: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    const { error: authError } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) {
      // Never distinguish "no such account" from "wrong password": that difference tells
      // an attacker which of the team's addresses are real.
      setError(t("login.error"));
      return;
    }
    onSignedIn();
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="small mut" style={{ margin: 0 }}>
        {t("login.subtitle")}
      </p>

      <Field label={t("login.email")}>
        <Input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label={t("login.password")}>
        <Input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {error ? (
        <p className="lerr" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" loading={busy} block>
        {busy ? t("login.submitting") : t("login.submit")}
      </Button>

      {/* La puerta para quien NO es del equipo.
          Va acá y no en el encabezado por dos motivos. Uno: el encabezado de un mapa de
          emergencia es espacio caro y ya lleva seis controles. Dos: éste es el sitio donde
          alguien llega buscando entrar y descubre que no tiene cuenta — sin esta línea, el
          candado es una puerta cerrada sin timbre, que es exactamente lo que pasaba. */}
      <p className="small mut" style={{ margin: 0 }}>
        {t("login.noAccount")}{" "}
        <Link className="linkish" href="/registro">
          {t("login.createAccount")}
        </Link>
      </p>
    </form>
  );
}
