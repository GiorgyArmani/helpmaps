import { FEATURES, IS_HUB, LANGUAGE } from "@/config";
import { resolveLang } from "@/i18n";
import AppShell, { type EntryAction } from "@/features/app/AppShell";
import HubLanding from "@/features/hub/HubLanding";

/**
 * The root.
 *
 * Same codebase, two deployments: with NEXT_PUBLIC_MODE=hub this is helpmaps.net (the
 * network landing), otherwise it is a country app (col.helpmaps.net). Branching here
 * rather than in two route trees means every shared route — /docs, /api — stays
 * available and identical in both.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lang = resolveLang(first(params.lang)) ?? LANGUAGE.default;

  if (IS_HUB) return <HubLanding lang={lang} />;

  // `?c=<id>` opens a point directly — that is what a shared link redirects into when
  // someone taps "ver en el mapa" from the SSR card at /c/<id>.
  // `?panel=1` opens the staff panel over the map; /admin and /login redirect here.
  return (
    <AppShell
      initialCenterId={first(params.c)}
      initialAction={action(first(params.a))}
      initialPanel={first(params.panel) === "1"}
    />
  );
}

/**
 * `?a=` — what the visitor already said they came for, sent by the entry page. Narrowed
 * here rather than inside the app: an action whose feature is switched off must not open
 * a form that this deployment does not offer, and an unknown value is simply the map.
 */
function action(value: string | undefined): EntryAction | undefined {
  switch (value) {
    case "needs":
      return FEATURES.needs ? "needs" : undefined;
    case "suggest":
      return FEATURES.suggestions ? "suggest" : undefined;
    case "initiative":
      return FEATURES.suggestions ? "initiative" : undefined;
    case "volunteer":
      return FEATURES.volunteerSignup ? "volunteer" : undefined;
    case "donate":
      return FEATURES.donations ? "donate" : undefined;
    // Mi cuenta. No lleva interruptor: no es una función de la emergencia sino de quien
    // la está mirando, y es a donde aterriza el enlace de confirmación del correo.
    case "account":
      return "account";
    default:
      return undefined;
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
