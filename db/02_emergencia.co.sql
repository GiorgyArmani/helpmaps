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
  -- ⚠️ VACÍO A PROPÓSITO, Y NO SE PUBLICA ASÍ. Ver «La sísmica de Colombia» abajo:
  -- los tres números hay que MEDIRLOS, y el guardia de publicación lo exige.
  '{}'::jsonb,   -- hazard
  '[]'::jsonb,   -- layers
  -- Vacío = sin boletín, y la interfaz no muestra la pestaña. No hay configuración de
  -- prensa por defecto en `config/`: si no está acá, no existe. Ver abajo cómo llenarlo.
  '{}'::jsonb   -- news
)
on conflict (slug) do nothing;


-- ===========================================================================
-- La sísmica de Colombia — LO ÚNICO QUE FALTA, Y HAY QUE MEDIRLO
-- ===========================================================================
--
-- `hazard` quedó en `{}`, y eso significa que se heredan los valores de
-- `config/hazard.ts`: minMagnitude 4.5, windowDays 14, bounds null. Ése es el
-- comportamiento de Colombia HOY con el preset, así que dejarlo así no cambia nada al
-- publicar. Pero es incorrecto, y de una de las tres cosas hay certeza aritmética:
--
--   windowDays 14     El terremoto del Chocó es del 10 de agosto de 2026. Una ventana de
--                     14 días deja de alcanzarlo el 24 de agosto. Es decir: el mapa de
--                     Colombia YA no muestra el epicentro de su propio terremoto, y no
--                     por un fallo sino por un valor por defecto pensado para otra cosa.
--                     Esto no hay que medirlo, se cuenta con los dedos.
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
-- `news` vacío = sin pestaña. Para encenderlo hacen falta `feeds` (los medios) y
-- `keywords`, que es el filtro de relevancia y cruza DOS listas: una palabra de
-- emergencia Y una de lugar. Sólo emergencia llena el boletín de terremotos en Japón;
-- sólo lugar lo llena de cualquier noticia que mencione Bogotá.
--
-- La estructura está en `db/02_emergencia.sql`, con los 13 medios de Venezuela como
-- ejemplo. Para Colombia los `place` serían del estilo "chocó", "san josé del palmar",
-- "quibdó", "risaralda", "quindío", "valle del cauca", "caldas", "pereira", "armenia":
-- los departamentos sacudidos, no el país entero.
--
-- Además necesita `NEWS_CRON_SECRET` en el entorno del despliegue, o la ruta que lo
-- genera queda cerrada. Ése es el fallo seguro: sin secreto no se genera nada, en vez de
-- quedar abierta y sin saldo.


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
--   if fila.hz->'seismic' is null then
--     raise exception 'La sismica sigue sin medir: se publicaria con windowDays=14, que ya no alcanza al terremoto del 10 de agosto. Ver la seccion de sismica en este archivo.';
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
