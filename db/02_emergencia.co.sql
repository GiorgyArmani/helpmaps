-- ===========================================================================
-- HelpMaps · QUÉ EMERGENCIA SIRVE ESTE DESPLIEGUE — COLOMBIA.
-- Corre esto después de 01_esquema.sql, en la base de Colombia y sólo en ella.
-- ===========================================================================
--
-- Es la copia de `02_emergencia.sql` para Colombia, que es exactamente el uso que ese
-- archivo documenta: se copia, se cambian los valores, y no se toca nada más — ni el
-- esquema, ni `src/`, ni una línea de código.
--
-- ⚠️ NO CORRAS `02_emergencia.sql` EN ESTA BASE. Ese lleva la fila de Venezuela dentro.
-- Correr los dos deja las dos emergencias en la misma base, y el despliegue resuelve por
-- `host`: la de Venezuela nunca casaría, se quedaría de okupa y el día que alguien mire
-- `emergencies` no sabría cuál manda.
--
-- ── ESTA FILA HOY NO HACE FALTA ─────────────────────────────────────────────
--
-- Colombia funciona sin ella. `config/presets/colombia.ts` ya trae los 33 departamentos,
-- el encuadre sobre el epicentro del Chocó y el aviso legal, y sin fila que case por
-- `host` la aplicación sirve ese preset compilado. Además `belongs_to()` devuelve `true`
-- para `emergency_id` nulo, así que el alcance por emergencia se comporta como antes de
-- existir: el equipo ve todo lo de su despliegue.
--
-- Lo que la fila compra es poder cambiar encuadre, marca, aviso legal, umbrales sísmicos
-- y medios de prensa DESDE EL PANEL, en caliente. Con el preset, cada uno de esos cambios
-- es un redespliegue. Por eso está escrita y por eso queda en `draft`.
--
-- ── LOS VALORES SON LOS DEL PRESET, A PROPÓSITO ─────────────────────────────
--
-- Cada campo de abajo reproduce `config/presets/colombia.ts` tal como está hoy. No es
-- pereza: si la fila dijera algo distinto, publicarla cambiaría el sitio en silencio y
-- nadie sabría cuál de los dos cambios lo hizo. La fila empieza siendo un espejo; a
-- partir de ahí se edita desde el panel y ella manda.
--
-- La única excepción declarada es `hazard`, y está explicada abajo con letras grandes.
--
-- Idempotente por `slug`.
-- ===========================================================================

insert into public.emergencies (
  slug, host, country_code, country_name, name, hazard_type, status,
  region_noun, geo, regions, legal, brand, features, language, hazard, layers, news
) values (
  'co-terremoto-2026',
  -- El dominio EXACTO que ve el servidor, en minúsculas y sin esquema. Colombia sirve
  -- desde el subdominio directamente, así que aquí no hay el problema del apex que
  -- redirige a `www` que sí tiene Venezuela.
  'co.helpmaps.net',
  'CO',
  'Colombia',
  -- El EVENTO, no el país: es lo que se lee en el encabezado y en el boletín.
  'Terremoto del Chocó 2026',
  'earthquake',
  -- Nace en borrador. Publicar es el último bloque del archivo, y va comentado.
  'draft',
  '{
    "one": "departamento",
    "many": "departamentos"
  }'::jsonb,   -- region_noun
  '{
    "zoom": 8,
    "bounds": [
      [
        -4.23,
        -81.85
      ],
      [
        13.5,
        -66.85
      ]
    ],
    "center": [
      4.8436,
      -76.2422
    ],
    "regionZoom": 9,
    "geocodeCountry": "co"
  }'::jsonb,   -- geo
  '[
    {
      "lat": -1.2,
      "lng": -71.6,
      "code": "amazonas",
      "name": "Amazonas"
    },
    {
      "lat": 6.9,
      "lng": -75.5,
      "code": "antioquia",
      "name": "Antioquia"
    },
    {
      "lat": 6.55,
      "lng": -70.95,
      "code": "arauca",
      "name": "Arauca"
    },
    {
      "lat": 10.75,
      "lng": -74.9,
      "code": "atlantico",
      "name": "Atlántico"
    },
    {
      "lat": 4.65,
      "lng": -74.1,
      "code": "bogota_dc",
      "name": "Bogotá D.C.",
      "zoom": 11
    },
    {
      "lat": 8.75,
      "lng": -74.4,
      "code": "bolivar",
      "name": "Bolívar"
    },
    {
      "lat": 5.75,
      "lng": -73.1,
      "code": "boyaca",
      "name": "Boyacá"
    },
    {
      "lat": 5.3,
      "lng": -75.3,
      "code": "caldas",
      "name": "Caldas"
    },
    {
      "lat": 0.8,
      "lng": -74.3,
      "code": "caqueta",
      "name": "Caquetá"
    },
    {
      "lat": 5.4,
      "lng": -71.6,
      "code": "casanare",
      "name": "Casanare"
    },
    {
      "lat": 2.5,
      "lng": -76.8,
      "code": "cauca",
      "name": "Cauca"
    },
    {
      "lat": 9.5,
      "lng": -73.5,
      "code": "cesar",
      "name": "Cesar"
    },
    {
      "lat": 5.7,
      "lng": -76.65,
      "code": "choco",
      "name": "Chocó"
    },
    {
      "lat": 8.35,
      "lng": -75.8,
      "code": "cordoba",
      "name": "Córdoba"
    },
    {
      "lat": 4.8,
      "lng": -74.3,
      "code": "cundinamarca",
      "name": "Cundinamarca"
    },
    {
      "lat": 2.6,
      "lng": -68.8,
      "code": "guainia",
      "name": "Guainía"
    },
    {
      "lat": 2.05,
      "lng": -72.3,
      "code": "guaviare",
      "name": "Guaviare"
    },
    {
      "lat": 2.55,
      "lng": -75.5,
      "code": "huila",
      "name": "Huila"
    },
    {
      "lat": 11.35,
      "lng": -72.55,
      "code": "la_guajira",
      "name": "La Guajira"
    },
    {
      "lat": 10.2,
      "lng": -74.3,
      "code": "magdalena",
      "name": "Magdalena"
    },
    {
      "lat": 3.5,
      "lng": -73.1,
      "code": "meta",
      "name": "Meta"
    },
    {
      "lat": 1.55,
      "lng": -77.6,
      "code": "narino",
      "name": "Nariño"
    },
    {
      "lat": 7.95,
      "lng": -72.9,
      "code": "norte_de_santander",
      "name": "Norte de Santander"
    },
    {
      "lat": 0.7,
      "lng": -76.3,
      "code": "putumayo",
      "name": "Putumayo"
    },
    {
      "lat": 4.45,
      "lng": -75.7,
      "code": "quindio",
      "name": "Quindío",
      "zoom": 10
    },
    {
      "lat": 5.1,
      "lng": -75.9,
      "code": "risaralda",
      "name": "Risaralda"
    },
    {
      "lat": 12.55,
      "lng": -81.72,
      "code": "san_andres",
      "name": "San Andrés y Providencia",
      "zoom": 10
    },
    {
      "lat": 6.9,
      "lng": -73.4,
      "code": "santander",
      "name": "Santander"
    },
    {
      "lat": 9.1,
      "lng": -75.1,
      "code": "sucre",
      "name": "Sucre"
    },
    {
      "lat": 4.1,
      "lng": -75.2,
      "code": "tolima",
      "name": "Tolima"
    },
    {
      "lat": 3.8,
      "lng": -76.4,
      "code": "valle_del_cauca",
      "name": "Valle del Cauca"
    },
    {
      "lat": 0.7,
      "lng": -70.6,
      "code": "vaupes",
      "name": "Vaupés"
    },
    {
      "lat": 4.9,
      "lng": -69.5,
      "code": "vichada",
      "name": "Vichada"
    }
  ]'::jsonb,   -- regions
  '{
    "dataLaw": "la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013 (habeas data)",
    "controller": "HelpMaps Colombia",
    "jurisdiction": "Colombia",
    "privacyEmail": "info@helpmaps.net"
  }'::jsonb,   -- legal
  -- Sólo el isotipo, igual que el preset. El resto de la marca —incluido
  -- `contact.email`, que sale de `legal.privacyEmail`— lo pone `config/brand.ts`.
  -- Repetirlo acá sería fijar hoy un valor que mañana cambia en un solo sitio.
  '{
    "logo": "/colombia.png"
  }'::jsonb,   -- brand
  -- Vacío hereda lo que ofrece la red (`config/features.ts`). Una función se enciende
  -- cuando ya existe el dato que la sustenta, no antes.
  '{}'::jsonb,   -- features
  -- Toda fuente colombiana del sismo de agosto —alcaldías, gobernaciones, Cruz Roja, la
  -- prensa— dice "albergue". El diccionario base dice "Refugio", que es la palabra de
  -- Venezuela. Este mapa existe para ser buscable en las palabras que la gente usa.
  '{
    "overrides": {
      "es": {
        "type.shelter": "Albergue",
        "type.shelter.plural": "Albergues"
      }
    }
  }'::jsonb,   -- language
  -- ESPEJO DE `config/presets/colombia.ts`, y tiene que seguir siéndolo.
  --
  -- Si esto quedara vacío, publicar la fila REVERTIRÍA la ventana al 14 heredado de
  -- `config/hazard.ts` y el sismo del 10 de agosto volvería a desaparecer del mapa: la
  -- fila gana sobre el preset, así que un campo vacío acá no significa "usa el preset",
  -- significa "usa el valor por defecto de la red".
  --
  -- `minMagnitude` y `bounds` siguen sin declararse porque siguen sin medirse. Ver
  -- «La sísmica de Colombia» abajo.
  '{
    "seismic": {
      "windowDays": 180
    }
  }'::jsonb,   -- hazard
  '[]'::jsonb,   -- layers
  -- Los diez medios se comprobaron uno a uno el 2026-08-28: los diez responden 200 con
  -- content-type XML. Un feed muerto no rompe el boletín —se reporta como fuente con
  -- error— pero tampoco aporta, y una lista sin verificar es una lista de adivinanzas.
  --
  -- Dos son de la ZONA SACUDIDA y son los que justifican la lista: La Patria cubre
  -- Manizales y Caldas, El Diario cubre Pereira y Risaralda. Un boletín hecho sólo de
  -- medios nacionales cuenta el terremoto; los regionales cuentan qué alcaldía abrió
  -- qué albergue, que es lo que alguien necesita saber.
  --
  -- El filtro cruza LAS DOS listas: una palabra de emergencia Y una de lugar. Sólo
  -- emergencia llena el boletín de terremotos en Japón; sólo lugar lo llena de cualquier
  -- noticia que mencione Bogotá. En `place` van con y sin tilde a propósito: los
  -- titulares de RSS no son consistentes con los acentos.
  --
  -- `deslizamiento` está en la lista de emergencia y no está en la de Venezuela: en la
  -- cordillera colombiana el daño que sigue a un sismo son los deslizamientos, y una
  -- vía cerrada por un derrumbe decide a qué albergue se puede llegar.
  '{
    "feeds": [
      {
        "id": "eltiempo",
        "url": "https://www.eltiempo.com/rss/colombia.xml",
        "name": "El Tiempo (Colombia)"
      },
      {
        "id": "elcolombiano",
        "url": "https://www.elcolombiano.com/rss/portada.xml",
        "name": "El Colombiano"
      },
      {
        "id": "publimetro",
        "url": "https://www.publimetro.co/arc/outboundfeeds/rss/?outputType=xml",
        "name": "Publimetro Colombia"
      },
      {
        "id": "lapatria",
        "url": "https://www.lapatria.com/rss.xml",
        "name": "La Patria (Manizales)"
      },
      {
        "id": "diariootun",
        "url": "https://www.eldiario.com.co/feed/",
        "name": "El Diario (Pereira)"
      },
      {
        "id": "bbcmundo",
        "url": "https://feeds.bbci.co.uk/mundo/rss.xml",
        "name": "BBC Mundo"
      },
      {
        "id": "dw",
        "url": "https://rss.dw.com/xml/rss-es-all",
        "name": "DW (Deutsche Welle)"
      },
      {
        "id": "elpais",
        "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada",
        "name": "El País (América)"
      },
      {
        "id": "reliefweb",
        "url": "https://reliefweb.int/updates/rss.xml",
        "name": "ReliefWeb (ONU)"
      },
      {
        "id": "unocha",
        "url": "https://www.unocha.org/rss.xml",
        "name": "UN OCHA (ONU)"
      }
    ],
    "keywords": {
      "place": [
        "colombia",
        "chocó",
        "choco",
        "san josé del palmar",
        "san jose del palmar",
        "quibdó",
        "quibdo",
        "istmina",
        "tadó",
        "condoto",
        "risaralda",
        "pereira",
        "dosquebradas",
        "quindío",
        "quindio",
        "armenia",
        "caldas",
        "manizales",
        "valle del cauca",
        "cali",
        "buenaventura",
        "cartago",
        "tuluá",
        "eje cafetero"
      ],
      "emergency": [
        "sismo",
        "terremoto",
        "temblor",
        "réplica",
        "albergue",
        "refugio",
        "acopio",
        "damnificados",
        "evacuación",
        "emergencia",
        "rescate",
        "escombros",
        "derrumbe",
        "colapso",
        "deslizamiento",
        "magnitud",
        "epicentro",
        "desaparecidos",
        "víctimas",
        "fallecidos",
        "heridos",
        "ayuda humanitaria",
        "tragedia",
        "catástrofe"
      ]
    },
    "refreshHours": 4
  }'::jsonb   -- news
)
on conflict (slug) do nothing;


-- ===========================================================================
-- La sísmica de Colombia — LO ÚNICO QUE FALTA, Y HAY QUE MEDIRLO
-- ===========================================================================
--
-- De los tres números, uno ya está puesto —arriba y en el preset— y dos siguen sin medir.
--
-- El que está puesto no hacía falta medirlo, se cuenta con los dedos:
--
--   windowDays 180    El terremoto del Chocó es del 10 de agosto de 2026 y el valor
--                     heredado era 14: dejó de alcanzarlo el 24 de agosto. Sin epicentros
--                     no hay evento principal, y sin evento principal `useQuakes.ts:96`
--                     ni pide los contornos, así que "Zona afectada" también salía vacía.
--                     180 días lo sostienen hasta el 6 DE FEBRERO DE 2027.
--
--                     El tope de maxEvents (60) no amenaza al principal: `usgs.ts`
--                     consulta con orderby=magnitude y recorta por impacto, así que lo
--                     que se pierde por arriba son los eventos pequeños, nunca el mayor.
--
--   minMagnitude 4.5  Sospechoso, pero NO evidente, y por eso no lo toco. El del Chocó
--                     fue a 110 km de profundidad, y un sismo intermedio produce muchas
--                     menos réplicas que uno superficial: el 3.5 que Venezuela necesitó
--                     puede acá no hacer falta, o puede inundar el mapa.
--
--   bounds null       Cae al encuadre del mapa, que en Colombia va de -4.23 a 13.5 de
--                     latitud y de -81.85 a -66.85 de longitud. Ese rectángulo mete
--                     dentro el norte de Ecuador, el sur de Panamá, la frontera con Perú
--                     y buena parte de Venezuela, todas zonas activas. En Venezuela el
--                     mismo error metía 22 sismos ajenos de 52.
--
-- COMO SE MIDE (es lo que se hizo para Venezuela)
--
-- Cuenta eventos reales contra USGS antes de elegir cada número. maxEvents es 60 y el
-- corte es SILENCIOSO: trunca la lista y el mapa queda a medias sin avisar. Así que la
-- ventana tiene que alcanzar al 10 de agosto SIN pasar de 60.
--
--   curl -s "https://earthquake.usgs.gov/fdsnws/event/count?format=geojson&starttime=2026-02-10&endtime=2026-08-28&minmagnitude=3.5&minlatitude=-4.23&maxlatitude=13.5&minlongitude=-81.85&maxlongitude=-66.85"
--
-- Repite cambiando starttime (90/180/240 días), minmagnitude (3.5 / 4.0 / 4.5) y la
-- caja, y arma la tabla de tres columnas como la de Venezuela. Después, para la caja,
-- baja los eventos con query en vez de count y cuenta cuántos son colombianos:
--
--   curl -s "...query?format=geojson&..." | jq -r ".features[].properties.place" | sort | uniq -c | sort -rn
--
-- La caja que se elige NO es la silueta de Colombia: es su cinturón sísmico. Acá eso son
-- dos cosas muy distintas y conviene saberlo antes de dibujar un rectángulo: la
-- subducción del Pacífico frente a Nariño y Cauca, mar afuera, donde están los grandes y
-- los tsunamigénicos; y el nido de Bucaramanga, sismicidad profunda y constante a 600 km
-- de la primera. Un rectángulo que cubra las dos cubre también medio Ecuador y medio
-- Venezuela, así que puede que Colombia necesite otra cosa que un rectángulo, y eso hay
-- que decidirlo con los números delante.
--
-- Y NO copies la caja de Venezuela. Está en `config/presets/venezuela.ts` con sus
-- mediciones al lado y describe el límite Caribe-Suramericana, que no pasa por acá.
--
-- Cuando tengas los tres números, ponlos arriba en `hazard` con la tabla medida al lado,
-- y en `config/presets/colombia.ts` con la misma tabla, para que el preset y la fila no
-- digan cosas distintas.


-- ===========================================================================
-- El boletín de prensa, si se quiere
-- ===========================================================================
--
-- Los diez medios y las dos listas de palabras ya están arriba. Lo que sigue es lo que
-- HACE FALTA ADEMÁS, porque la fila sola no enciende nada:
--
--   1. Publicar la fila. `news` sólo existe en `emergencies`: lo confirma que la palabra
--      no aparezca en ningún archivo de `config/`, sólo en `src/config/fromRow.ts`. Un
--      despliegue servido desde el preset compilado NO PUEDE tener boletín, por diseño.
--      Y `NewsTab.tsx:75` corta en `if (!emergency || !newsEnabled(...)) return null`:
--      sin fila resuelta falla la PRIMERA condición y la pestaña ni se monta.
--
--   2. `NEWS_CRON_SECRET` en el entorno del despliegue. Sin él `POST /api/news` responde
--      401 y no se genera nada. Ése es el fallo seguro: un despliegue que lo olvidó se
--      queda sin boletín; uno que quedara abierto se queda sin saldo.
--
--   3. ALGUIEN QUE LLAME A ESA RUTA. No hay `vercel.json` en el repo, así que no existe
--      ningún cron declarado en ninguna parte: ni Colombia ni Venezuela regeneran el
--      boletín solos. Hoy hay que dispararlo a mano:
--
--        curl -X POST https://co.helpmaps.net/api/news -H "x-cron-secret: <el secreto>"
--
--      Añadir `?dry=1` lo corre sin escribir, que es como se prueba la lista de medios
--      sin ensuciar la tabla.
--
--   4. `OPENROUTER_API_KEY`, opcional. Sin ella publica los titulares agrupados por
--      medio, que ya es útil; con ella añade una síntesis marcada como automática.


-- ===========================================================================
-- El primer superadmin
-- ===========================================================================
--
-- No se puede crear desde la aplicación, por la misma razón que el primer admin: haría
-- falta ser uno para hacerlo. Crea la cuenta en Authentication then Users y después:
--
--   insert into public.staff_users (user_id, role, email)
--   select id, 'superadmin', email from auth.users where email = 'tu@correo.net'
--   on conflict (user_id) do update set role = 'superadmin';
--
-- Un superadmin no necesita filas en `staff_emergencies`: las políticas preguntan
-- `is_superadmin()` en lugar de mirar la membresía, así que las alcanza todas.


-- ===========================================================================
-- Atar los puntos que ya existen a esta fila
-- ===========================================================================
--
-- La base de Colombia ya tenía datos antes de que existiera `emergencies`, así que sus
-- `locations` tienen `emergency_id` nulo. Nulo significa "de este despliegue, para todo
-- el mundo", que es correcto mientras haya UNA emergencia y deja de serlo en cuanto haya
-- dos: los nulos los seguiría viendo todo el mundo.
--
-- Si publicas esta fila, corre también esto. Si no la publicas, no hace falta.
--
--   update public.locations
--      set emergency_id = (select id from public.emergencies where slug = 'co-terremoto-2026')
--    where emergency_id is null;
--
-- Lo mismo para `submissions`, `volunteer_requests` y `donations` si ya tienen filas.


-- ===========================================================================
-- PUBLICAR — el único paso de todo el archivo que un visitante puede notar
-- ===========================================================================
--
-- Va comentado a propósito: correr este archivo entero NUNCA debe publicar. Se descomenta
-- cuando se decide anunciar, y no antes.
--
-- A partir de esa línea el dominio sirve LA FILA y no el preset compilado. Para volver
-- atrás: update public.emergencies set status = 'draft' where slug = ... El sitio vuelve
-- al preset en cuanto expire la caché de 60 segundos de `src/server/emergency.ts`. No
-- hace falta redesplegar.
--
-- Los dos primeros guardias existen porque los dos fallos ya ocurrieron: publicar con
-- capas de demostración puestas, y publicar con la marca a medias. El tercero es de esta
-- copia: publicar heredando una ventana sísmica que ya no alcanza al propio terremoto.
-- ===========================================================================

-- do $$
-- declare demo int; fila record;
-- begin
--   select count(*) into demo
--     from public.emergencies e, lateral jsonb_array_elements(e.layers) l
--    where e.slug = 'co-terremoto-2026' and l->>'label' like 'DEMO %';
--   if demo > 0 then
--     raise exception 'Hay % capa(s) de demostracion cargadas. No se publica sobre datos sinteticos.', demo;
--   end if;
--
--   select host, brand->>'logo' as logo, legal->>'controller' as responsable, hazard as hz
--     into fila from public.emergencies where slug = 'co-terremoto-2026';
--   if fila is null      then raise exception 'No existe la emergencia: corre antes el insert de arriba.'; end if;
--   if fila.host is null then raise exception 'La fila no declara host.'; end if;
--   if fila.logo is null then raise exception 'La fila no declara logo: se publicaria sin isotipo.'; end if;
--   if fila.hz->'seismic'->'windowDays' is null then
--     raise exception 'La fila no declara windowDays: al publicar se caeria al 14 por defecto y el terremoto del 10 de agosto desapareceria del mapa. Ver la seccion de sismica en este archivo.';
--   end if;
-- end $$;
--
-- update public.emergencies set status = 'active' where slug = 'co-terremoto-2026';


-- ===========================================================================
-- Verificación
--
--   select slug, status, host,
--          brand->>'logo'                as logo,
--          legal->>'controller'          as responsable,
--          jsonb_array_length(regions)   as departamentos,
--          jsonb_array_length(layers)    as capas,
--          hazard->'seismic'             as sismica
--     from public.emergencies;
--
-- Y después, siempre, `03_verificacion.sql`.
-- ===========================================================================
