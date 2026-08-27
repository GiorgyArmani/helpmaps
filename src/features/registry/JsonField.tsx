"use client";

import { useState } from "react";
import { Field, TextArea } from "@/ui/primitives";

/**
 * A nested configuration block, edited as JSON.
 *
 * ── WHY JSON AND NOT A FORM ─────────────────────────────────────────────────
 *
 * `regions` is an array of objects, `brand` is a partial of a nested shape, `features` is
 * a set of switches that grows whenever the network adds a module. A bespoke form for each
 * would be the larger half of this console and would fall behind `src/config/types.ts` the
 * first time that file changes.
 *
 * The audience is a superadmin configuring a country, not a member of the public, and the
 * text they are editing is the exact object the presets already hold — someone who can
 * write `config/presets/venezuela.ts` can write this. The scalar fields that everyone
 * touches (name, host, viewport, legal notice) do get real inputs.
 *
 * Parsing happens on every keystroke so the error appears where the mistake is, and the
 * value only propagates upward when it parses: a half-typed brace never reaches the draft.
 *
 * The text is seeded ONCE, from the initial value. Switching to a different emergency
 * remounts the form (see the `key` in `RegistryConsole`) rather than syncing this state
 * from props in an effect — an effect there would fight whatever the person is typing, and
 * this component is the only writer of the block anyway.
 */
export function JsonField({
  label,
  hint,
  value,
  onChange,
  rows = 6,
}: {
  label: string;
  hint?: string;
  value: unknown;
  onChange: (parsed: unknown) => void;
  rows?: number;
}) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [error, setError] = useState<string | null>(null);

  function handle(next: string) {
    setText(next);
    if (next.trim() === "") {
      setError(null);
      onChange(null);
      return;
    }
    try {
      onChange(JSON.parse(next));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "JSON inválido");
    }
  }

  return (
    <Field label={label} hint={error ?? hint}>
      <TextArea
        rows={rows}
        spellCheck={false}
        value={text}
        onChange={(e) => handle(e.target.value)}
        style={error ? { borderColor: "var(--danger)" } : undefined}
      />
    </Field>
  );
}
