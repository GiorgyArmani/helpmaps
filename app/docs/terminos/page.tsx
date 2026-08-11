import type { Metadata } from "next";
import { DocShell, DocSection } from "../DocShell";
import { BRAND } from "@/config";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: `Para qué sirve ${BRAND.platform}, qué no garantiza y qué usos no están permitidos.`,
};

export default function TermsPage() {
  return (
    <DocShell base="/docs/terminos" title="Términos de uso" lead={`Para qué sirve ${BRAND.platform}, qué no garantiza y qué usos no están permitidos.`}>

      <DocSection heading={`Para qué sirve`}>
        <p>
          {BRAND.platform} es una herramienta de información ciudadana: muestra dónde hay ayuda disponible y
          dónde hace falta. Es gratuita y no cobra a nadie por aparecer ni por consultar.
        </p>
      </DocSection>

      <DocSection heading={`Qué no garantiza`}>
        <p>
          La información la reportan los propios puntos, el equipo en terreno y el público. Está
          fechada y se actualiza, pero <strong>no garantiza cupo, existencias ni que el lugar siga
          abierto</strong> en el momento en que la leas. Confirma por teléfono antes de trasladarte,
          especialmente si la ficha avisa de que nadie ha confirmado el punto recientemente.
        </p>
      </DocSection>

      <DocSection heading={`Usos que no están permitidos`}>
        <ul>
          <li>Usar los datos para contactar, presionar o perfilar a las personas de estos lugares.</li>
          <li>Publicar puntos falsos o necesidades inventadas.</li>
          <li>Cobrar por el acceso a la información o presentarla como propia sin atribución.</li>
          <li>Usar el mapa con fines de propaganda o para condicionar la ayuda a una afiliación.</li>
        </ul>
        <p>
          La ayuda se muestra sin distinción política, social ni racial, y esperamos lo mismo de quien
          use estos datos.
        </p>
      </DocSection>

      <DocSection heading={`Reutilización`}>
        <p>
          Los puntos publicados están disponibles en la API pública bajo{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/deed.es" rel="noopener noreferrer">
            CC BY 4.0
          </a>
          : puedes reutilizarlos citando la fuente. La cartografía base es de{" "}
          <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer">
            OpenStreetMap
          </a>{" "}
          (ODbL). El código del proyecto es abierto bajo{" "}
          <a href="https://opensource.org/license/mit" rel="noopener noreferrer">
            licencia MIT
          </a>
          {BRAND.contact.repo ? (
            <>
              {" "}
              y está publicado en{" "}
              <a href={BRAND.contact.repo} target="_blank" rel="noopener noreferrer">
                {repoLabel(BRAND.contact.repo)}
              </a>
            </>
          ) : null}
          : cualquiera puede auditarlo y desplegarlo en su país.
        </p>
      </DocSection>

      <DocSection heading={`Contacto`}>
        <p>
          <a href={`mailto:${BRAND.contact.email}`}>{BRAND.contact.email}</a>
        </p>
      </DocSection>
    </DocShell>
  );
}

/** "github.com/usuario/repo" — sin esquema, que en un enlace visible solo estorba. */
function repoLabel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}
