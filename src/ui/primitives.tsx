import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "@/ui/icons";

// Thin wrappers over the ported design-system classes (see app/globals.css). They exist
// so a component says "primary button" instead of remembering that it is `.btnp`, and so
// a change to the system happens in one place. No component-local styling lives here.

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ── Buttons ────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "whatsapp" | "call";

export function Button({
  variant = "primary",
  small,
  loading,
  block,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  small?: boolean;
  /** Full width — the shape a form submit takes on a phone. */
  block?: boolean;
  loading?: boolean;
}) {
  const base = variant === "primary" ? "btnp" : "btng";
  return (
    <button
      type="button"
      className={cx(
        base,
        variant === "whatsapp" && "btnwa",
        variant === "call" && "btncall",
        variant === "danger" && "btndanger",
        small && "btnsm",
        block && "btnblock",
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Square icon button used in overlay headers and staff rows. */
export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx("oicon", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Chip ───────────────────────────────────────────────────────────────────

export function Chip({
  on,
  onClick,
  children,
  ariaLabel,
}: {
  on?: boolean;
  onClick?: () => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  if (typeof onClick !== "function") {
    return <span className="dtag">{children}</span>;
  }
  return (
    <button
      type="button"
      className={cx("chip", on && "chip-on")}
      onClick={onClick}
      aria-pressed={Boolean(on)}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────

export function Badge({
  tone = "off",
  children,
}: {
  tone?: "ok" | "warn" | "danger" | "off";
  children: ReactNode;
}) {
  return (
    <span className={cx("badge", `st-${tone}`)}>
      <span className="dot" />
      {children}
    </span>
  );
}

// ── Fields ─────────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  optional,
  optionalLabel = "opcional",
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  optionalLabel?: string;
  children: ReactNode;
}) {
  return (
    <label className="fld">
      <span className="flabel">
        {label}
        {optional ? ` · ${optionalLabel}` : ""}
      </span>
      {children}
      {hint ? <span className="fhint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("finput", className)} {...rest} />;
}

export function TextArea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("finput", className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("fselect", className)} {...rest}>
      {children}
    </select>
  );
}

// ── Notice ─────────────────────────────────────────────────────────────────

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "danger";
  children: ReactNode;
}) {
  return (
    <div
      className={cx("note", tone === "warn" && "note-warn", tone === "danger" && "note-danger")}
      role={tone === "info" ? undefined : "alert"}
    >
      <Icon.alert />
      <div>{children}</div>
    </div>
  );
}

/** Inline busy indicator, used while a gate resolves. */
export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
