// Inline SVG icon set. Inline rather than an icon package because the whole app must
// paint on a slow 3G connection without waiting on a second request, and because these
// need to be recolourable per point type from `config/map.ts`.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </Svg>
  ),
  close: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  back: (p: IconProps) => (
    <Svg {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  ),
  chevron: (p: IconProps) => (
    <Svg {...p}>
      <path d="m9 5 7 7-7 7" />
    </Svg>
  ),
  share: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
    </Svg>
  ),
  phone: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" />
    </Svg>
  ),
  whatsapp: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 20l1.4-4A8 8 0 1 1 8 18.6L4 20Z" />
      <path d="M9.2 9.4c.3 1.6 1.8 3.1 3.4 3.4l.8-1.1 1.9.8v1.2c-2.6.4-5.4-2.4-5.9-5h1.2l.6 1.9-1 .8" />
    </Svg>
  ),
  directions: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  ),
  // GPS crosshair. The small centre circle is the point, not a ring around it — at r=7
  // the ticks detach from the body and it reads as a sun rather than a fix on a map.
  target: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Svg>
  ),
  heart: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z" />
    </Svg>
  ),
  plus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  mail: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </Svg>
  ),
  question: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.4" />
      <path d="M12 16.8v.1" />
    </Svg>
  ),
  pencil: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m14 6 4 4" />
    </Svg>
  ),
  minus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 12h14" />
    </Svg>
  ),
  hand: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5.2-3l-2-3.4a1.5 1.5 0 0 1 2.4-1.8L9 14" />
    </Svg>
  ),
  // A real cog: a closed toothed rim around the hub. The previous version drew eight
  // detached spokes radiating from a circle, which at 18px is the universal brightness
  // glyph — people read the account-settings button as a light/dark toggle and pressed it
  // expecting the theme to flip. Teeth attached to a ring cannot be read that way.
  gear: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.5 1Z" />
    </Svg>
  ),
  // The activity feed. Rings, not a plain dome — a dome alone reads as a shelter marker,
  // which this panel also uses.
  bell: (p: IconProps) => (
    <Svg {...p}>
      <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </Svg>
  ),
  // Sliders — the staff entry once a session exists. Distinct from the padlock (which
  // means "sign in") because at that point signing in is done: this opens the panel.
  sliders: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2.2" fill="#fff" />
      <circle cx="15" cy="12" r="2.2" fill="#fff" />
      <circle cx="8" cy="18" r="2.2" fill="#fff" />
    </Svg>
  ),
  alert: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 4 2.8 20h18.4L12 4Z" />
      <path d="M12 10v4M12 17.2v.1" />
    </Svg>
  ),
  check: (p: IconProps) => (
    <Svg {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  ),
  clock: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  ),
  link: (p: IconProps) => (
    <Svg {...p}>
      <path d="M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.5 6" />
      <path d="M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7L12.5 18" />
    </Svg>
  ),
  // ── Point types ────────────────────────────────────────────────────────────
  // Keys match `icon` in config/map.ts. Geometry is the HelpMap Venezuela set verbatim
  // (`components/helpmap/icons.tsx`), because these six have to be told apart at 12px on
  // a map pin and that set is the one already proven on real phones in a real emergency.
  //
  // The thing that makes them work is that no two share a silhouette. An earlier version
  // here drew shelter, hospital and morgue as three variations on a house, which at pin
  // size collapsed into the same shape — the filter chips looked distinct while the map
  // they controlled did not.
  shelter: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M5.5 10.5V20h13v-9.5" />
      <path d="M9.5 20v-6h5v6" />
    </Svg>
  ),
  // Open box — the donations a point receives.
  box: (p: IconProps) => (
    <Svg {...p}>
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </Svg>
  ),
  meal: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M6 12v9" />
      <path d="M18 3c-1.7 0-3 2-3 5s1 4 3 4v9" />
    </Svg>
  ),
  spark: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 11 10.1 9 12 3.5Z" />
    </Svg>
  ),
  // Group of people. A civic initiative is organised neighbours, not a building — which
  // is also why it must not be the sparkle this app was using: a sparkle reads as
  // "featured" or "new", not as a kind of place you can walk to.
  users: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20v-1.2A4.8 4.8 0 0 1 7.3 14h3.4a4.8 4.8 0 0 1 4.8 4.8V20" />
      <path d="M16.4 5.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M18.2 14.2a4.2 4.2 0 0 1 3.3 4.1V20" />
    </Svg>
  ),
  // A cross in a SQUARE, not on a roof: the medical cross is what has to survive being
  // shrunk, and a gabled outline spends its detail budget on the roof instead.
  hospital: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3.5" y="4" width="17" height="17" rx="2" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Svg>
  ),
  // Memorial arch — a respectful, non-graphic stand-in for a morgue.
  morgue: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 21V10.5a6 6 0 0 1 12 0V21" />
      <path d="M4.5 21h15" />
    </Svg>
  ),
  // A hand offering a heart — "I want to help". Kept distinct from `users` (a group of
  // people), which labels a civic initiative: one is an offer, the other is a place.
  volunteer: (p: IconProps) => (
    <Svg {...p}>
      <path d="M11 14.5 8.8 12.4a1.7 1.7 0 0 1 2.4-2.4l1 1 1-1a1.7 1.7 0 0 1 2.4 2.4L13 14.5a1.4 1.4 0 0 1-2 0Z" />
      <path d="M3 13a2 2 0 0 1 2-2h1.5l3 2.6a2 2 0 0 0 1.3.5H15a1.5 1.5 0 0 1 0 3h-3" />
      <path d="M3 13v6h2.5l5.5 1.5 8-2.5a1.7 1.7 0 0 0-1.2-3.1" />
    </Svg>
  ),
  // Una sola persona. `users` es un grupo —rotula una iniciativa ciudadana— y este es
  // "tu cuenta": el avatar de la barra cuando todavía no hay sesión que ponerle inicial.
  user: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20v-1.1A5.4 5.4 0 0 1 9.9 13.5h4.2a5.4 5.4 0 0 1 5.4 5.4V20" />
    </Svg>
  ),
  // Padlock — the header entry to staff sign-in. Not a gear: a gear promises settings,
  // and at 19px the spoked version of it reads as a sun.
  lock: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  ),
  // Puerta con flecha saliendo. El menú de la cuenta usaba el candado para "cerrar
  // sesión", que es el icono de ENTRAR: el mismo dibujo para las dos direcciones.
  logout: (p: IconProps) => (
    <Svg {...p}>
      <path d="M14.5 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8" />
      <path d="M18 15.5 21.5 12 18 8.5" />
      <path d="M21 12h-9.5" />
    </Svg>
  ),
  // Stacked sheets — the near-universal "map layers" mark. Legible at 19px, which the
  // usual three-diamond version is not.
  layers: (p: IconProps) => (
    <Svg {...p}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3.5 12.5 8.5 4.7 8.5-4.7" />
      <path d="m3.5 16.5 8.5 4.7 8.5-4.7" />
    </Svg>
  ),
  // Concentric arcs radiating from a point: shaking spreading out from an epicentre.
  waves: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="1.6" />
      <path d="M8.4 15.6a5.1 5.1 0 0 1 0-7.2M15.6 8.4a5.1 5.1 0 0 1 0 7.2" />
      <path d="M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
    </Svg>
  ),
} as const;

export type IconName = keyof typeof Icon;

/**
 * The glyph for a point type, by the `icon` key in `config/map.ts`.
 *
 * Written as a switch over static JSX rather than a lookup that returns a component:
 * picking a component out of a map during render is exactly the pattern React's compiler
 * refuses, and an unknown key falls back to a generic pin instead of rendering nothing.
 */
export function TypeGlyph({ name, size = 18 }: { name: string; size?: number }) {
  switch (name) {
    case "shelter":
      return <Icon.shelter width={size} height={size} />;
    case "box":
      return <Icon.box width={size} height={size} />;
    case "meal":
      return <Icon.meal width={size} height={size} />;
    case "spark":
      return <Icon.spark width={size} height={size} />;
    case "users":
      return <Icon.users width={size} height={size} />;
    case "hospital":
      return <Icon.hospital width={size} height={size} />;
    case "morgue":
      return <Icon.morgue width={size} height={size} />;
    default:
      return <Icon.directions width={size} height={size} />;
  }
}
