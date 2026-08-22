-- HelpMaps · semilla de demostración — OPCIONAL. No la corras en producción.
--
-- Crea una emergencia a partir del preset `config/presets/venezuela.ts`, campo por campo,
-- para probar que la tabla y el preset son el mismo objeto: nada aquí está traducido ni
-- adaptado, solo movido de un archivo a una fila.
--
-- Idempotente por `slug`.
--
-- ---------------------------------------------------------------------------
-- Sobre el controlador de datos
--
-- `legal.controller` es la organización que responde legalmente por los datos personales
-- que publica el despliegue, y es la dirección a la que escribe quien quiere que lo
-- corrijan o lo saquen. Esta fila nombra a AcopioVE porque el despliegue de pruebas corre
-- en su infraestructura y con sus datos: apuntar a otra organización mandaría solicitudes
-- de bajada a una bandeja ajena por algo que no opera.
--
-- Cuando esta emergencia viva en el despliegue de HelpMaps Venezuela, el controlador pasa
-- a ser el suyo. Que sea una columna y no una constante compilada es justamente lo que
-- permite que cada emergencia declare la verdad en un despliegue conjunto.
-- ---------------------------------------------------------------------------

insert into public.emergencies (
  slug, host, country_code, country_name, name, hazard_type, status,
  region_noun, geo, regions, legal, brand, features, language, hazard, layers
) values (
  've-terremoto-2026',
  null,                       -- sin host todavía: se asigna al publicar
  'VE',
  'Venezuela',
  'Terremoto de Venezuela 2026',
  'earthquake',
  'draft',

  '{"one":"estado","many":"estados"}'::jsonb,

  '{
     "center": [10.3, -67.0],
     "zoom": 8,
     "regionZoom": 9,
     "bounds": [[0.6, -73.4], [12.3, -59.8]],
     "geocodeCountry": "ve"
   }'::jsonb,

  '[
     {"code":"amazonas","name":"Amazonas","lat":3.9,"lng":-65.8},
     {"code":"anzoategui","name":"Anzoátegui","lat":9.0,"lng":-64.3},
     {"code":"apure","name":"Apure","lat":7.0,"lng":-68.5},
     {"code":"aragua","name":"Aragua","lat":10.1,"lng":-67.3},
     {"code":"barinas","name":"Barinas","lat":8.3,"lng":-70.0},
     {"code":"bolivar","name":"Bolívar","lat":5.8,"lng":-63.5},
     {"code":"carabobo","name":"Carabobo","lat":10.2,"lng":-68.1},
     {"code":"cojedes","name":"Cojedes","lat":9.3,"lng":-68.4},
     {"code":"delta_amacuro","name":"Delta Amacuro","lat":9.0,"lng":-61.3},
     {"code":"distrito_capital","name":"Distrito Capital","lat":10.49,"lng":-66.88,"zoom":12},
     {"code":"falcon","name":"Falcón","lat":11.2,"lng":-69.8},
     {"code":"guarico","name":"Guárico","lat":8.9,"lng":-66.4},
     {"code":"la_guaira","name":"La Guaira","lat":10.6,"lng":-66.9,"zoom":11},
     {"code":"lara","name":"Lara","lat":10.1,"lng":-69.8},
     {"code":"merida","name":"Mérida","lat":8.5,"lng":-71.2},
     {"code":"miranda","name":"Miranda","lat":10.3,"lng":-66.4},
     {"code":"monagas","name":"Monagas","lat":9.4,"lng":-63.2},
     {"code":"nueva_esparta","name":"Nueva Esparta","lat":11.0,"lng":-63.9},
     {"code":"portuguesa","name":"Portuguesa","lat":9.1,"lng":-69.3},
     {"code":"sucre","name":"Sucre","lat":10.4,"lng":-63.5},
     {"code":"tachira","name":"Táchira","lat":7.8,"lng":-72.2},
     {"code":"trujillo","name":"Trujillo","lat":9.3,"lng":-70.5},
     {"code":"yaracuy","name":"Yaracuy","lat":10.3,"lng":-68.8},
     {"code":"zulia","name":"Zulia","lat":10.0,"lng":-71.8}
   ]'::jsonb,

  '{
     "controller": "AcopioVE (acopiove.org)",
     "privacyEmail": "info@acopiove.org",
     "dataLaw": "los artículos 28 y 60 de la Constitución y la LOPNNA (art. 65)",
     "jurisdiction": "Venezuela"
   }'::jsonb,

  '{"logo": null}'::jsonb,
  '{}'::jsonb,                -- sin overrides: hereda lo que ofrece la red
  '{}'::jsonb,                -- "Refugio" es la palabra que usa Venezuela; no hay override
  '{}'::jsonb,                -- la sísmica se hereda de config/hazard.ts
  '[]'::jsonb                 -- las capas de AcopioVE entran en la fase 3
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Boletín de prensa
--
-- Los medios y el filtro de relevancia que AcopioVE viene usando desde el primer día.
--
-- El filtro cruza DOS listas: una palabra de emergencia Y una de lugar. Una sola no
-- alcanza — solo emergencia llena el boletín de terremotos en Japón, y solo lugar lo
-- llena de cualquier noticia que mencione Caracas. Un despliegue en otro país cambia las
-- dos listas, y por eso viven en la fila y no en el código.
-- ---------------------------------------------------------------------------

update public.emergencies set news = $news$
{
  "feeds": [
    {
      "id": "elpais",
      "name": "El País (América)",
      "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada"
    },
    {
      "id": "rt",
      "name": "RT (Russia Today)",
      "url": "https://actualidad.rt.com/feeds/all.rss"
    },
    {
      "id": "aporrea",
      "name": "Aporrea",
      "url": "http://feeds.feedburner.com/aporrea/noticias"
    },
    {
      "id": "dw",
      "name": "DW (Deutsche Welle)",
      "url": "https://rss.dw.com/xml/rss-es-all"
    },
    {
      "id": "lanacion",
      "name": "La Nación",
      "url": "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml"
    },
    {
      "id": "nytimes",
      "name": "New York Times (World)",
      "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
    },
    {
      "id": "caracaschronicles",
      "name": "Caracas Chronicles",
      "url": "https://caracaschronicles.com/feed"
    },
    {
      "id": "eldiario",
      "name": "El Diario",
      "url": "https://eldiario.com/feed/"
    },
    {
      "id": "efectococuyo",
      "name": "Efecto Cocuyo",
      "url": "https://efectococuyo.com/feed/"
    },
    {
      "id": "elnacional",
      "name": "El Nacional",
      "url": "https://www.elnacional.com/feed/"
    },
    {
      "id": "bbcmundo",
      "name": "BBC Mundo",
      "url": "https://feeds.bbci.co.uk/mundo/rss.xml"
    },
    {
      "id": "reliefweb",
      "name": "ReliefWeb (ONU)",
      "url": "https://reliefweb.int/updates/rss.xml"
    },
    {
      "id": "unocha",
      "name": "UN OCHA (ONU)",
      "url": "https://www.unocha.org/rss.xml"
    }
  ],
  "keywords": {
    "emergency": [
      "sismo",
      "terremoto",
      "temblor",
      "réplica",
      "tsunami",
      "catástrofe",
      "tragedia",
      "derrumbe",
      "colapso",
      "refugio",
      "acopio",
      "albergue",
      "desaparecidos",
      "víctimas",
      "fallecidos",
      "heridos",
      "ayuda humanitaria",
      "damnificados",
      "evacuación",
      "emergencia",
      "rescate",
      "escombros",
      "magnitud",
      "epicentro"
    ],
    "place": [
      "venezuela",
      "caracas",
      "yaracuy",
      "la guaira",
      "vargas",
      "falcón",
      "falcon",
      "portuguesa",
      "valencia",
      "maracay",
      "san felipe",
      "yumare",
      "nirgua",
      "morón",
      "moron",
      "carabobo",
      "barquisimeto",
      "lara",
      "miranda",
      "catia la mar",
      "macuto",
      "maiquetía",
      "maiquetia",
      "tucacas",
      "puerto cabello"
    ]
  },
  "refreshHours": 4
}
$news$::jsonb
where slug = 've-terremoto-2026';

-- ---------------------------------------------------------------------------
-- Primer superadmin. No se puede crear desde la aplicación, por la misma razón que el
-- primer admin: haría falta ser uno para hacerlo. Creá el usuario en
-- Authentication → Users y después, con su UUID:
--
--   insert into public.staff_users (user_id, role, email)
--   values ('00000000-0000-0000-0000-000000000000', 'superadmin', 'tu@correo.net')
--   on conflict (user_id) do update set role = 'superadmin';
--
-- Un superadmin no necesita filas en `staff_emergencies`: alcanza todas.
-- ---------------------------------------------------------------------------
