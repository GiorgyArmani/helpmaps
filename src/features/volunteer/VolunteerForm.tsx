"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Notice, Select, TextArea } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";
import PrivacyNotice from "@/features/suggest/PrivacyNotice";
import { useSite } from "@/features/app/SiteProvider";
import { getSupabase } from "@/lib/supabase/client";
import { fetchMyProfile, fetchMyVolunteerRequest, type MyVolunteerRequest } from "@/data/account";

/** Quién está postulándose: `undefined` mientras se pregunta, `null` sin sesión. */
type Applicant = { email: string; request: MyVolunteerRequest | null } | null | undefined;

/**
 * "Join the team".
 *
 * Panel access means publishing live onto a map people act on, so this creates a request
 * an admin reviews — never an account. The account is created afterwards, from the
 * panel, by a route that checks the caller is an admin first.
 *
 * Con sesión no se pide el correo —ya está en la cuenta y la ruta lo toma de ahí— y quien
 * ya tiene una postulación pendiente o aprobada ve en qué quedó, no otro formulario.
 */
export default function VolunteerForm({ onDone }: { onDone: () => void }) {
  const site = useSite();
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    profile: "",
    region: "",
    motivation: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error" | "limited" | "already">(
    "idle",
  );
  // Sin Supabase no hay sesión posible: se sabe ya, sin preguntar.
  const [applicant, setApplicant] = useState<Applicant>(() => (getSupabase() ? undefined : null));

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    void (async () => {
      const { data } = await sb.auth.getUser();
      const user = data.user;
      if (!user?.email) {
        if (!cancelled) setApplicant(null);
        return;
      }
      const [profile, request] = await Promise.all([
        fetchMyProfile(sb),
        fetchMyVolunteerRequest(sb),
      ]);
      if (cancelled) return;
      setApplicant({ email: user.email, request });
      // El nombre de la cuenta como punto de partida, sin pisar lo que ya se escribió.
      if (profile?.displayName) {
        setForm((f) => (f.name ? f : { ...f, name: profile.displayName }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signedIn = Boolean(applicant);

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
        // Con sesión el correo lo pone el servidor desde la cuenta.
        body: JSON.stringify(signedIn ? { ...form, email: "" } : form),
      });
      if (res.status === 409) {
        setState("already");
        return;
      }
      if (res.status === 429) {
        setState("limited");
        return;
      }
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  // Ya postulado: se dice en qué quedó en vez de ofrecer mandarlo otra vez. Rechazada no
  // entra acá: después de un rechazo se puede volver a postular.
  const live =
    state === "already" ||
    applicant?.request?.status === "pending" ||
    applicant?.request?.status === "approved";
  if (live && state !== "done") {
    return (
      <div className="stack" style={{ paddingBottom: 24 }}>
        <Notice tone="info">
          {applicant?.request?.status === "approved"
            ? t("account.volApproved")
            : t("account.volPending")}
        </Notice>
        <Button variant="secondary" onClick={onDone}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="stack" style={{ paddingBottom: 24 }}>
        <p className="lok">
          <strong>{t("volunteer.done")}</strong>
          <br />
          {signedIn && applicant
            ? t("volunteer.doneBodyAccount", { email: applicant.email })
            : t("volunteer.doneBody")}
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

      {/* El hueco del correo se reserva mientras se sabe si hay sesión: sin él, el campo
          aparecía y desaparecía empujando el resto del formulario. */}
      {applicant === undefined ? (
        <span className="skel acc-skel" aria-hidden="true" />
      ) : applicant ? (
        <p className="small mut">{t("volunteer.asAccount", { email: applicant.email })}</p>
      ) : (
        <Field label={t("volunteer.email")}>
          <Input required type="email" value={form.email} maxLength={120} onChange={set("email")} />
        </Field>
      )}

      <Field label={t("volunteer.phone")} optional optionalLabel={t("common.optional")}>
        <Input value={form.phone} maxLength={24} inputMode="tel" onChange={set("phone")} />
      </Field>

      <Field label={t("volunteer.profile")} hint={t("volunteer.profileHint")}>
        <Input value={form.profile} maxLength={120} onChange={set("profile")} />
      </Field>

      <Field label={t("volunteer.region")} optional optionalLabel={t("common.optional")}>
        <Select value={form.region} onChange={set("region")}>
          <option value="">—</option>
          {site.country.regions.map((r) => (
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

      <Button
        type="submit"
        loading={state === "sending"}
        disabled={applicant === undefined || !form.name || (!signedIn && !form.email)}
      >
        {state === "sending" ? t("suggest.sending") : t("volunteer.submit")}
      </Button>
    </form>
  );
}
