"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Notice, TextArea } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";
import PrivacyNotice from "@/features/suggest/PrivacyNotice";
import { compressImage } from "@/lib/uploadPhoto";

/**
 * "Write to us" — how an organisation asks to be listed in the donations directory.
 *
 * It sends an email and writes nothing, which is why it carries anti-abuse machinery a
 * plain form does not: a honeypot field and how long the form was open. Both are checked
 * server-side; a bot that trips either gets a cheerful 200 and nothing happens.
 *
 * Images are compressed in the browser before they are attached. Someone photographing a
 * registration document on a phone otherwise sends four 6 MB files over one bar of
 * signal, and the send fails at the worst possible moment.
 *
 * There is deliberately NO acknowledgment email. This panel is the receipt.
 */
export default function ContactForm({
  kind = "general",
  onDone,
}: {
  kind?: "donation" | "general";
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState(false);
  const [hp, setHp] = useState("");
  // Stamped after mount, not during render: reading the clock while rendering is impure
  // and React may render this twice. Null until then, and an unknown dwell time is simply
  // not sent — the server treats a missing value as "no signal either way".
  const openedAt = useRef<number | null>(null);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error" | "limited">("idle");

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || images.length >= 4) return;
    setImageError(false);
    try {
      const compressed = await compressImage(file);
      setImages((list) => (list.length >= 4 ? list : [...list, compressed]));
    } catch {
      setImageError(true);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10 || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          name,
          email,
          message,
          images,
          hp,
          elapsed: openedAt.current === null ? undefined : Date.now() - openedAt.current,
        }),
      });
      if (res.status === 429) {
        setState("limited");
        return;
      }
      setState(res.ok ? "done" : "error");
    } catch {
      // No offline queue here, unlike a suggestion: a queued email that goes out hours
      // later, after the sender has given up waiting, is worse than an honest failure.
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="stack" style={{ paddingBottom: 24 }}>
        <p className="lok">
          <strong>{t("contact.done")}</strong>
          <br />
          {t("contact.doneBody")}
        </p>
        <Button variant="secondary" onClick={onDone}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit} style={{ paddingBottom: 24 }}>
      <p className="small mut">
        {kind === "donation" ? t("contact.subDonation") : t("contact.subGeneral")}
      </p>

      {/* Honeypot: off-screen, not tabbable, hidden from assistive tech. A person never
          sees it; a bot that fills every field does. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <Field label={t("contact.message")}>
        <TextArea
          required
          value={message}
          maxLength={5000}
          placeholder={kind === "donation" ? t("contact.messageHintDonation") : ""}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>

      <Field label={t("contact.name")} optional optionalLabel={t("common.optional")}>
        <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field label={t("contact.email")} hint={t("contact.emailHint")}>
        <Input
          type="email"
          value={email}
          maxLength={120}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label={t("contact.photos")} hint={t("contact.photosHint")} optional optionalLabel={t("common.optional")}>
        {images.length > 0 ? (
          <div className="cimg-grid">
            {images.map((src, i) => (
              <div className="cimg" key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a local data: URL, never a remote asset */}
                <img src={src} alt="" />
                <button
                  type="button"
                  className="cimg-x"
                  aria-label={t("common.delete")}
                  onClick={() => setImages((list) => list.filter((_, n) => n !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {images.length < 4 ? (
          <label className="upload">
            <input type="file" accept="image/*" onChange={pickImage} style={{ display: "none" }} />
            {t("contact.addPhoto")}
          </label>
        ) : null}
      </Field>

      <PrivacyNotice />

      {imageError ? <Notice tone="warn">{t("contact.photoError")}</Notice> : null}
      {state === "error" ? <Notice tone="danger">{t("contact.error")}</Notice> : null}
      {state === "limited" ? <Notice tone="warn">{t("contact.tooMany")}</Notice> : null}

      <Button type="submit" loading={state === "sending"} disabled={message.trim().length < 10}>
        {state === "sending" ? t("contact.sending") : t("contact.submit")}
      </Button>
    </form>
  );
}
