/**
 * The HelpMaps isotype.
 *
 * From the brand manual (`docs/marca/manual-marca.html`): a four-pointed cardinal star
 * crossed with the humanitarian aid cross — geographic orientation and help in one mark —
 * with a solid core joined to four satellite nodes at the cardinal points.
 *
 * ── THE LOADER IS THE SAME MARK ─────────────────────────────────────────────
 *
 * With `loading`, the four nodes pulse in sequence anticlockwise (right, up, left, down),
 * which is the loading animation the manual specifies. It is deliberately the SAME
 * drawing and not a separate spinner: on a slow connection the mark is often the first
 * thing that paints, and having it come alive says "this is working" with something the
 * reader already recognises instead of a generic ring.
 *
 * Geometry is kept in the manual's 920×920 space so the proportions stay exactly as
 * published; `size` only scales it.
 */
export default function Isotype({
  size = 30,
  loading = false,
  tone = "dark",
  className,
}: {
  size?: number;
  /** Pulse the four nodes in sequence. */
  loading?: boolean;
  /**
   * `dark` is the Monocromático Dark of the brand manual — white structure on deep black
   * — and is the default: it is the version the manual leads with, and against a pale grey
   * basemap it reads as a mark rather than dissolving into the chrome around it.
   */
  tone?: "light" | "dark";
  className?: string;
}) {
  const bg = tone === "dark" ? "#0F172A" : "#FFFFFF";
  const star = tone === "dark" ? "#1E293B" : "#F1F5F9";
  const ink = tone === "dark" ? "#FFFFFF" : "#334155";

  return (
    <svg
      viewBox="0 0 920 920"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <rect fill={bg} width="920" height="920" rx="253.78" />
      <path fill={star} d="M460,190 L520,380 L730,460 L520,540 L460,730 L400,540 L190,460 L400,380 Z" />
      <rect x="442" y="190" width="36" height="540" rx="18" fill={ink} />
      <rect x="190" y="442" width="540" height="36" rx="18" fill={ink} />
      <circle cx="460" cy="460" r="115" fill={ink} />

      {/* Los cuatro nodos cardinales. El orden de los retardos recorre derecha, arriba,
          izquierda y abajo — antihorario, como especifica el manual. */}
      <circle className={loading ? "iso-node" : undefined} style={delay(loading, 0)} cx="730" cy="460" r="54" fill={ink} />
      <circle className={loading ? "iso-node" : undefined} style={delay(loading, 1)} cx="460" cy="190" r="54" fill={ink} />
      <circle className={loading ? "iso-node" : undefined} style={delay(loading, 2)} cx="190" cy="460" r="54" fill={ink} />
      <circle className={loading ? "iso-node" : undefined} style={delay(loading, 3)} cx="460" cy="730" r="54" fill={ink} />
    </svg>
  );
}

/** 2s cycle across four nodes: half a second apart, negative so all four start mid-cycle. */
function delay(loading: boolean, step: number): React.CSSProperties | undefined {
  return loading ? { animationDelay: `${-step * 0.5}s` } : undefined;
}
