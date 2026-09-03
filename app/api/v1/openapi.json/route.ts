import { BRAND, COUNTRY, enabledTypes, hasFeature, siteUrl } from "@/config";
import { HELP_KINDS, CENTER_STATUSES } from "@/domain/types";

/**
 * The API contract, as OpenAPI 3.1, generated from this deployment's own configuration —
 * so the region and type enums it advertises are the ones this country actually serves,
 * and cannot drift from the code the way a hand-written document does.
 *
 * The hub (helpmaps.net) renders this document; partners can also feed it straight to a
 * client generator.
 */
export const revalidate = 3600;

export function GET() {
  if (!hasFeature("publicApi")) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const doc = {
    openapi: "3.1.0",
    info: {
      title: `${BRAND.name} — API pública`,
      version: "1.0.0",
      description:
        `Puntos de ayuda publicados por este despliegue de ${BRAND.platform}: refugios, puntos de acopio, ` +
        "comedores e iniciativas ciudadanas, con lo que cada uno recibe y necesita. Solo lectura, " +
        "sin llave, CORS abierto. Limitado a 60 peticiones por minuto por IP.",
      license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
      contact: { name: COUNTRY.legal.controller, email: COUNTRY.legal.privacyEmail },
    },
    servers: [{ url: siteUrl(), description: COUNTRY.name }],
    paths: {
      "/api/v1/centers": {
        get: {
          summary: "Listar puntos de ayuda",
          operationId: "listCenters",
          parameters: [
            {
              name: "region",
              in: "query",
              description: `Código de ${COUNTRY.regionNoun.one}.`,
              schema: { type: "string", enum: COUNTRY.regions.map((r) => r.code) },
            },
            {
              name: "type",
              in: "query",
              schema: { type: "string", enum: enabledTypes() },
            },
            {
              name: "needs",
              in: "query",
              description: "true → solo puntos que piden algo y no están cerrados.",
              schema: { type: "boolean" },
            },
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: CENTER_STATUSES },
            },
            { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            "200": {
              description: "Página de puntos",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/CenterPage" } },
              },
            },
            "400": { description: "Parámetro desconocido" },
            "429": { description: "Límite de peticiones excedido" },
            "503": { description: "Despliegue sin base de datos configurada" },
          },
        },
      },
    },
    components: {
      schemas: {
        CenterPage: {
          type: "object",
          required: ["country", "count", "data"],
          properties: {
            country: {
              type: "object",
              properties: {
                code: { type: "string" },
                name: { type: "string" },
                slug: { type: "string" },
              },
            },
            count: { type: "integer", description: "Total tras aplicar filtros." },
            limit: { type: "integer" },
            offset: { type: "integer" },
            next: { type: ["string", "null"], description: "Query string de la página siguiente." },
            data: { type: "array", items: { $ref: "#/components/schemas/Center" } },
          },
        },
        Center: {
          type: "object",
          // `lat`/`lng` left the required list when `digital` arrived: an initiative
          // with no seat has none, and says where it helps in `coverage_regions`.
          required: ["id", "name", "type"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: enabledTypes() },
            region: { type: ["string", "null"] },
            region_name: { type: ["string", "null"] },
            municipality: { type: ["string", "null"] },
            lat: { type: ["number", "null"], description: "WGS 84. null solo para type 'digital'." },
            lng: { type: ["number", "null"], description: "WGS 84. null solo para type 'digital'." },
            address: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            whatsapp: { type: ["string", "null"] },
            coverage_regions: {
              type: "array",
              items: { type: "string" },
              description:
                "Solo type 'digital': códigos de región donde presta ayuda. Vacío = todo el país. Siempre [] en los demás tipos.",
            },
            coverage_municipalities: {
              type: "array",
              items: { type: "string" },
              description: "Solo type 'digital': municipios dentro de esas regiones, texto libre.",
            },
            website: { type: ["string", "null"], format: "uri" },
            instagram: { type: ["string", "null"], description: "Usuario de Instagram, sin @." },
            status: {
              type: ["string", "null"],
              enum: [...CENTER_STATUSES, null],
              description:
                "null = sin confirmar. NUNCA asumas 'abierto' por defecto: mandar gente a un punto cerrado es el peor error posible con este campo.",
            },
            needs: { type: ["string", "null"], description: "Qué necesita ahora, texto libre." },
            receives: { type: "array", items: { type: "string" } },
            help: { type: "array", items: { type: "string", enum: HELP_KINDS } },
            category: { type: ["string", "null"] },
            schedule: { type: ["string", "null"] },
            is_animal: { type: "boolean" },
            source: { type: ["string", "null"], description: "Procedencia del dato." },
            last_confirmed_at: {
              type: ["string", "null"],
              format: "date-time",
              description: "Última vez que una persona confirmó el punto.",
            },
            updated_at: { type: ["string", "null"], format: "date-time" },
            url: { type: "string", format: "uri" },
          },
        },
      },
    },
  };

  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
