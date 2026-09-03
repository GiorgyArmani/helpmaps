import type { Metadata } from "next";
import { DocShell, DocSection } from "../DocShell";
import { BRAND, COUNTRY, IS_HUB, NETWORK, enabledTypes, siteUrl } from "@/config";
import { CENTER_STATUSES, HELP_KINDS } from "@/domain/types";

export const metadata: Metadata = {
  title: "API pública",
  description: `Documentación de la API de solo lectura de ${BRAND.platform}: puntos de ayuda en JSON.`,
};

/**
 * The public API documentation.
 *
 * On the hub it documents the contract every country shares; on a country deployment it
 * documents THAT country's endpoint, with its own regions and types listed. Both read
 * from the same config the API itself uses, so the docs cannot drift from the behaviour.
 */
export default function ApiDocsPage() {
  const base = IS_HUB ? "https://<pais>.helpmaps.net" : siteUrl();

  return (
    <DocShell base="/docs/api" title="API pública" lead={`Solo lectura · sin llave · CORS abierto · 60 peticiones por minuto por IP.`}>

      <section className="doc-section">
        <p>
          Cada despliegue de {BRAND.platform} publica sus puntos de ayuda en el mismo formato, así que quien
          integra un país los integra todos. Los datos se ofrecen bajo{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/deed.es" rel="noopener noreferrer">
            CC BY 4.0
          </a>
          : úsalos citando la fuente.
        </p>
      </section>

      <section className="doc-section">
        <p>
          Un punto de tipo <code>digital</code> es una iniciativa real sin sede física: llega con{" "}
          <code>lat</code> y <code>lng</code> en <code>null</code> y dice dónde ayuda en{" "}
          <code>coverage_regions</code> (códigos de región; vacío = todo el país). El filtro{" "}
          <code>?region=</code> la incluye si atiende esa región. No mandes a nadie a sus coordenadas:
          no las tiene.
        </p>
      </section>

      <DocSection heading={`Endpoint`}>
        <code className="code">{`GET ${base}/api/v1/centers`}</code>
        <p>
          Documento OpenAPI 3.1 generado por cada despliegue:{" "}
          <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>
        </p>
      </DocSection>

      <DocSection heading={`Parámetros`}>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Parámetro</th>
                <th>Valores</th>
                <th>Qué hace</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>region</td>
                <td>
                  código de {COUNTRY.regionNoun.one}
                  {IS_HUB ? "" : ` (${COUNTRY.regions.length} disponibles)`}
                </td>
                <td>Filtra por división administrativa.</td>
              </tr>
              <tr>
                <td>type</td>
                <td>{enabledTypes().join(" · ")}</td>
                <td>Tipo de punto.</td>
              </tr>
              <tr>
                <td>needs</td>
                <td>true</td>
                <td>Solo puntos que piden algo y no están cerrados.</td>
              </tr>
              <tr>
                <td>status</td>
                <td>{CENTER_STATUSES.join(" · ")}</td>
                <td>Estado operativo del punto.</td>
              </tr>
              <tr>
                <td>limit / offset</td>
                <td>hasta 500 / entero</td>
                <td>Paginación. La respuesta trae `next` cuando hay más.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection heading={`Ejemplo`}>
        <code className="code">{`curl "${base}/api/v1/centers?needs=true&limit=2"`}</code>
        <code className="code">{`{
  "country": { "code": "${COUNTRY.code}", "name": "${COUNTRY.name}", "slug": "${COUNTRY.slug}" },
  "count": 37,
  "limit": 2,
  "offset": 0,
  "next": "needs=true&limit=2&offset=2",
  "data": [
    {
      "id": "she_ejemplo_a1b2",
      "name": "Refugio de ejemplo",
      "type": "shelter",
      "region": "${COUNTRY.regions[0]?.code ?? "region"}",
      "lat": 0, "lng": 0,
      "status": null,
      "needs": "Agua, colchonetas",
      "receives": ["agua", "ropa"],
      "help": ["voluntariado", "especie"],
      "last_confirmed_at": "2026-08-09T14:02:00Z",
      "url": "${base}/c/she_ejemplo_a1b2"
    }
  ]
}`}</code>
      </DocSection>

      <DocSection heading={`Dos cosas que hay que respetar`}>
        <ul>
          <li>
            <strong>`status: null` significa desconocido</strong>, no abierto. Si tu aplicación lo
            pinta como disponible, va a mandar gente a puertas cerradas. Trátalo como
            &laquo;sin confirmar&raquo;.
          </li>
          <li>
            <strong>Muestra la fecha.</strong> `last_confirmed_at` y `updated_at` son parte del dato:
            una necesidad de hace tres semanas es una suposición, no información.
          </li>
        </ul>
        <p>
          Los campos <code>help</code> aceptan: {HELP_KINDS.join(" · ")}.
        </p>
      </DocSection>

      {IS_HUB ? (
        <DocSection heading={`Despliegues activos`}>
          <ul>
            {NETWORK.filter((d) => d.status === "live").map((d) => (
              <li key={d.slug}>
                {d.flag} {d.name} — <code>{d.url}/api/v1/centers</code>
              </li>
            ))}
          </ul>
        </DocSection>
      ) : null}
    </DocShell>
  );
}
