import "server-only";
import nodemailer from "nodemailer";
import { BRAND, COUNTRY, SITE, absoluteUrl, siteUrl } from "@/config";
import { cleanName, cleanText, isEmail } from "@/lib/sanitize";
import { emailT, type EmailKey, type EmailTranslate } from "@/lib/emailCopy";
import {
  button,
  divider,
  emailShell,
  field,
  heading,
  linkCard,
  mono,
  note,
  panel,
  paragraph,
  quote,
  sectionLabel,
} from "@/lib/emailTemplate";
import type { Lang } from "@/i18n/types";
import type { SubmissionKind } from "@/domain/types";

/**
 * Outbound email over SMTP.
 *
 * Three rules carried over from running this for real:
 *
 * 1. **It degrades, it never blocks.** Every send returns a boolean and every caller
 *    treats it as best-effort. A suggestion that reached the database is not lost
 *    because the mail server was down, and a volunteer request must not fail on it.
 *
 * 2. **We never email an address the caller supplied.** The first deployment sent an
 *    acknowledgment back to whoever filled the form, echoing their own name into it —
 *    which turned a trusted domain into a phishing relay the moment someone put a scam
 *    message in the name field. Notifications go to the FIXED team inbox only, and the
 *    one email that does reach a person (the welcome below) is triggered by an admin
 *    approving a request, never by a public form. Do not reintroduce a sender
 *    acknowledgment; the in-app confirmation panel is the receipt.
 *
 * 3. **Nothing here hardcodes a country, a colour or a sentence.** The frame comes from
 *    `config/brand.ts` (`src/lib/emailTemplate.ts`) and the words from
 *    `src/lib/emailCopy.ts`, which a clone overrides from `config/language.ts`. That is
 *    what makes these templates portable to the next deployment.
 *
 * Env (see .env.example): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM,
 * CONTACT_TO. Without a password the whole module is a no-op and the team reads the
 * submissions in the staff panel instead.
 */

const HOST = process.env.SMTP_HOST || "";
const PORT = Number(process.env.SMTP_PORT || 465);
const USER = process.env.SMTP_USER || "";
// SMTP_PASS is the documented name; SMTP_PASSWORD is accepted because that is what most
// hosting panels (Hostinger among them) call it when you copy their snippet, and the
// failure mode of getting it wrong is silent: mail simply never goes out.
const PASS = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "";
const FROM = process.env.SMTP_FROM || (USER ? `${BRAND.name} <${USER}>` : "");
const TO = process.env.CONTACT_TO || SITE.integrations.email.to || USER;

let transporter: nodemailer.Transporter | null = null;

export function emailConfigured(): boolean {
  return Boolean(PASS && HOST && USER && TO);
}

function getTransport(): nodemailer.Transporter | null {
  if (!emailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      // 465 = implicit TLS; 587 = STARTTLS (secure:false).
      secure: PORT === 465,
      auth: { user: USER, pass: PASS },
      // Fail fast rather than hanging ~22s when the port is blocked. The caller is a
      // request a person is waiting on.
      connectionTimeout: 10_000,
      greetingTimeout: 8_000,
      socketTimeout: 15_000,
      // Shared-hosting mail certs frequently do not match the mail.* hostname; accepting
      // them is what makes sending through the provider's own server work at all.
      tls: { rejectUnauthorized: false },
    });
  }
  return transporter;
}

interface Message {
  /** Defaults to the team inbox. Only the welcome email ever sets this. */
  to?: string;
  replyTo?: string;
  subject: string;
  html: string;
  /** Explicit plain-text alternative: a missing one costs real spam score. */
  text: string;
}

async function deliver(msg: Message): Promise<boolean> {
  const tx = getTransport();
  if (!tx) return false;
  try {
    await tx.sendMail({
      from: FROM,
      to: msg.to || TO,
      replyTo: msg.replyTo,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    return true;
  } catch (err) {
    // Logged, not thrown: the caller already succeeded at the part that matters.
    console.error("[email] send failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Only a real address, and only ours-to-reply-to. Never becomes a recipient. */
function replyTo(value: string | null | undefined): string | undefined {
  return value && isEmail(value.trim()) ? value.trim() : undefined;
}

function lines(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// A member of the public suggested a point
// ---------------------------------------------------------------------------

const KIND_KEY = {
  center: "email.kind.center",
  initiative: "email.kind.initiative",
  need: "email.kind.need",
  other: "email.kind.other",
} as const;

export async function notifySubmission(input: {
  kind: SubmissionKind | string;
  message: string;
  name: string | null;
  contact: string | null;
  lang?: Lang;
}): Promise<boolean> {
  const t: EmailTranslate = emailT(input.lang);
  const dash = t("email.none");
  const kindKey = KIND_KEY[input.kind as SubmissionKind] ?? "email.kind.other";
  const kind = t(kindKey);
  const name = cleanName(input.name ?? "") || dash;
  const contact = cleanText(input.contact ?? "", 120) || dash;
  const message = cleanText(input.message, 2000);
  const panelUrl = absoluteUrl("/admin");

  const html = emailShell({
    preheader: t("email.submission.preheader"),
    footer: t("email.footer.note", { brand: BRAND.name }),
    body: lines(
      heading(t("email.submission.title")),
      field(t("email.label.kind"), kind),
      quote(message),
      field(t("email.label.name"), name),
      field(t("email.label.contact"), contact),
      divider(),
      note(t("email.submission.note")),
      button(panelUrl, t("email.submission.cta")),
    ),
  });

  return deliver({
    subject: t("email.submission.subject", { brand: BRAND.short, kind }),
    replyTo: replyTo(input.contact),
    html,
    text: lines(
      t("email.submission.title"),
      `${t("email.label.kind")}: ${kind}`,
      "",
      message,
      "",
      `${t("email.label.name")}: ${name}`,
      `${t("email.label.contact")}: ${contact}`,
      "",
      `${t("email.submission.cta")}: ${panelUrl}`,
    ),
  });
}

// ---------------------------------------------------------------------------
// "Write to us" — an organisation asking to be listed, or a general message
// ---------------------------------------------------------------------------

export type ContactKind = "donation" | "general";

/** data: URL (or bare base64) → a nodemailer attachment. */
function attachment(dataUrl: string, index: number) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  const contentType = match?.[1] ?? "image/jpeg";
  const content = match ? match[2] : dataUrl;
  const ext = contentType.split("/")[1]?.split("+")[0] ?? "jpg";
  return {
    filename: `adjunto-${index + 1}.${ext}`,
    content,
    encoding: "base64" as const,
    contentType,
  };
}

/**
 * A message from the public contact form.
 *
 * `replyTo` is the only place a caller-supplied address is ever used, and it is never a
 * recipient: the mail goes to the fixed team inbox, and the address only lets the team
 * hit reply. Sending anything TO that address is what turned a trusted domain into a
 * phishing relay on the first deployment.
 *
 * `suspicious` TAGS the subject instead of dropping the message: a false positive that
 * silently swallows a real organisation costs more than a tagged one the team can filter.
 */
export async function sendContactEmail(input: {
  kind: ContactKind;
  name?: string | null;
  replyTo?: string | null;
  message: string;
  images?: string[];
  suspicious?: boolean;
  lang?: Lang;
}): Promise<boolean> {
  const tx = getTransport();
  if (!tx) return false;

  const t = emailT(input.lang);
  const kindLabel = t(`email.contact.kind.${input.kind}` as EmailKey);
  const name = cleanName(input.name ?? "") || t("email.none");
  const from = replyTo(input.replyTo);
  const message = cleanText(input.message, 5000);
  const images = (input.images ?? []).slice(0, 4);

  const html = emailShell({
    preheader: t("email.contact.preheader", { name, kind: kindLabel }),
    footer: t("email.footer.note", { brand: BRAND.name }),
    body: lines(
      heading(t("email.contact.title")),
      field(t("email.label.kind"), kindLabel),
      field(t("email.contact.from"), `${name} (${from ?? t("email.contact.noEmail")})`),
      quote(message),
      images.length ? note(t("email.contact.images", { n: images.length })) : "",
    ),
  });

  try {
    await tx.sendMail({
      from: FROM,
      to: TO,
      replyTo: from,
      subject: `${input.suspicious ? `${t("email.contact.spamTag")} ` : ""}${t(
        "email.contact.subject",
        { brand: BRAND.short, kind: kindLabel, name },
      )}`,
      html,
      text: lines(
        `${t("email.label.kind")}: ${kindLabel}`,
        `${t("email.contact.from")}: ${name} (${from ?? t("email.contact.noEmail")})`,
        "",
        message,
        images.length ? `\n${t("email.contact.images", { n: images.length })}` : "",
      ),
      attachments: images.map(attachment),
    });
    return true;
  } catch (err) {
    console.error("[email] contact send failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

// NOTE: there is deliberately NO acknowledgment email back to the sender. See rule 2 at
// the top of this file — the in-app confirmation panel is the receipt.

// ---------------------------------------------------------------------------
// Someone asked to join the team
// ---------------------------------------------------------------------------

export async function notifyVolunteerRequest(input: {
  name: string;
  email: string;
  phone: string | null;
  profile: string | null;
  region: string | null;
  motivation: string | null;
  lang?: Lang;
}): Promise<boolean> {
  const t = emailT(input.lang);
  const dash = t("email.none");
  const name = cleanName(input.name) || dash;
  const email = cleanText(input.email, 120);
  const phone = cleanText(input.phone ?? "", 40) || dash;
  const profile = cleanText(input.profile ?? "", 200) || dash;
  // The stored value is a region CODE; the label comes from the country preset, so the
  // team reads "Chocó" and not "choco".
  const region = input.region ? regionName(input.region) : dash;
  const motivation = cleanText(input.motivation ?? "", 1200);
  const panelUrl = absoluteUrl("/admin");

  const html = emailShell({
    preheader: t("email.volunteer.preheader", { name }),
    footer: t("email.footer.note", { brand: BRAND.name }),
    body: lines(
      heading(t("email.volunteer.title")),
      field(t("email.label.name"), name),
      field(t("email.label.email"), email),
      field(t("email.label.phone"), phone),
      field(t("email.label.profile"), profile),
      field(t("email.label.region"), region),
      motivation && sectionLabel(t("email.label.motivation")),
      motivation && quote(motivation),
      divider(),
      note(t("email.volunteer.note")),
      button(panelUrl, t("email.volunteer.cta")),
    ),
  });

  return deliver({
    subject: t("email.volunteer.subject", { brand: BRAND.short, name }),
    replyTo: replyTo(input.email),
    html,
    text: lines(
      t("email.volunteer.title"),
      `${t("email.label.name")}: ${name}`,
      `${t("email.label.email")}: ${email}`,
      `${t("email.label.phone")}: ${phone}`,
      `${t("email.label.profile")}: ${profile}`,
      `${t("email.label.region")}: ${region}`,
      "",
      motivation || "",
      "",
      t("email.volunteer.note"),
      `${t("email.volunteer.cta")}: ${panelUrl}`,
    ),
  });
}

function regionName(code: string): string {
  return COUNTRY.regions.find((r) => r.code === code)?.name ?? code;
}

// ---------------------------------------------------------------------------
// Onboarding for a volunteer who just got access
// ---------------------------------------------------------------------------

/**
 * The only email that goes to a person instead of the team inbox, and it is triggered by
 * an admin approving a request — never by a public form. Two shapes, one template:
 *
 *   • no `tempPassword` → they signed up and set their own password (the normal path).
 *     We must not invent, echo or "remind" them of a password.
 *   • `tempPassword`    → an admin created the account by hand, so the credential ships.
 *
 * The manual itself lives in the public docs rather than inside the body: until SPF,
 * DKIM and DMARC are configured, deliverability to external inboxes is unreliable, and a
 * link survives a spam folder better than a wall of text nobody can find again.
 */
export async function sendVolunteerWelcome(input: {
  to: string;
  name?: string | null;
  tempPassword?: string;
  lang?: Lang;
  /** Overrides the canonical origin (previews, staging). */
  site?: string;
}): Promise<boolean> {
  if (!isEmail(input.to)) return false;

  const t = emailT(input.lang);
  const site = (input.site ?? siteUrl()).replace(/\/+$/, "");
  const loginUrl = `${site}/login`;
  const manualUrl = `${site}/docs/manual-voluntario`;
  const privacyUrl = `${site}/docs/privacidad`;
  const guideUrl = `${site}/docs/guia`;
  const contact = BRAND.contact.email;

  const greetName = cleanName(input.name ?? "");
  const greeting = greetName
    ? t("email.welcome.greeting", { name: greetName })
    : t("email.welcome.greetingPlain");

  const credentials = input.tempPassword
    ? panel(
        lines(
          mono(t("email.label.email"), input.to),
          `<div style="height:10px"></div>`,
          mono(t("email.welcome.tempPassword"), input.tempPassword),
          `<div style="margin-top:10px;font-size:12px;color:#8b93a1">${t("email.welcome.changePassword")}</div>`,
        ),
      )
    : paragraph(t("email.welcome.ownPassword", { email: input.to }));

  const html = emailShell({
    site,
    preheader: t("email.welcome.preheader"),
    footer: t("email.footer.note", { brand: BRAND.name }),
    body: lines(
      heading(t("email.welcome.title", { brand: BRAND.name })),
      paragraph(`${greeting} ${t("email.welcome.intro")}`),
      paragraph(t("email.welcome.live")),
      credentials,
      button(loginUrl, t("email.welcome.login")),
      sectionLabel(t("email.welcome.manuals")),
      linkCard(manualUrl, t("email.welcome.manualTitle"), t("email.welcome.manualDesc")),
      linkCard(privacyUrl, t("email.welcome.privacyTitle"), t("email.welcome.privacyDesc")),
      linkCard(guideUrl, t("email.welcome.guideTitle"), t("email.welcome.guideDesc")),
      note(t("email.welcome.help", { email: contact })),
    ),
  });

  return deliver({
    to: input.to,
    subject: t("email.welcome.subject", { brand: BRAND.name }),
    html,
    text: lines(
      t("email.welcome.title", { brand: BRAND.name }),
      "",
      `${greeting} ${t("email.welcome.intro")}`,
      "",
      t("email.welcome.live"),
      "",
      input.tempPassword
        ? `${t("email.label.email")}: ${input.to}\n${t("email.welcome.tempPassword")}: ${input.tempPassword}\n${t("email.welcome.changePassword")}`
        : t("email.welcome.ownPassword", { email: input.to }),
      "",
      `${t("email.welcome.login")}: ${loginUrl}`,
      "",
      `${t("email.welcome.manuals")}:`,
      `- ${t("email.welcome.manualTitle")}: ${manualUrl}`,
      `- ${t("email.welcome.privacyTitle")}: ${privacyUrl}`,
      `- ${t("email.welcome.guideTitle")}: ${guideUrl}`,
      "",
      t("email.welcome.help", { email: contact }),
    ),
  });
}
