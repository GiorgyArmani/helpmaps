-- ===========================================================================
-- HelpMaps · QUÉ EMERGENCIA SIRVE ESTE DESPLIEGUE. Corre esto después de 01_esquema.sql.
-- ===========================================================================
--
-- `01_esquema.sql` levanta una base que no sabe de qué país es. Este archivo es el que se
-- lo dice: una fila en `emergencies` con el país, su viewport, sus estados, su marca, su
-- aviso legal, su configuración sísmica y sus medios de prensa.
--
-- ES LA PLANTILLA. Para otro país se copia este archivo, se cambian los valores de abajo
-- y no se toca nada más — ni el esquema, ni `src/`, ni una línea de código. Los valores
-- que siguen son los de Venezuela, y están tal como quedaron después de operarla: no son
-- un ejemplo inventado, son una fila que funciona.
--
-- Idempotente por `slug`.
--
-- ---------------------------------------------------------------------------
-- LA FILA GANA SOBRE `config/presets/<pais>.ts`
--
-- El repo trae presets compilados, y la aplicación cae a ellos cuando ninguna fila
-- reclama el host de la petición. En cuanto esta fila está `active` y su `host` coincide,
-- lo que manda es la fila — entera, no campo por campo.
--
-- Por eso los valores de acá tienen que estar COMPLETOS. Un `brand` a medias no hereda
-- del preset lo que le falta: publica sin logo. Ya pasó.
--
-- ---------------------------------------------------------------------------
-- NACE EN `draft`, Y ESO ES DELIBERADO
--
-- Mientras esté en borrador, la política de `01_esquema.sql` no la devuelve a `anon` y
-- `src/server/emergency.ts` la descarta: el sitio sigue sirviendo el preset compilado y
-- nadie de fuera ve nada. Publicar es el último paso, va al final de este archivo y está
-- COMENTADO a propósito, para que correr el archivo entero nunca publique por accidente.
--
-- Para previsualizarla antes de publicar: `HELPMAPS_EMERGENCY=<slug>` en el entorno LOCAL
-- (nunca en producción). Esa variable fuerza el slug y sí sirve borradores.
-- ===========================================================================

insert into public.emergencies (
  slug, host, country_code, country_name, name, hazard_type, status,
  region_noun, geo, regions, legal, brand, features, language, hazard, layers, news
) values (
  've-terremoto-2026',
  'www.helpmapvzla.net',
  'VE',
  'Venezuela',
  'Terremoto de Venezuela 2026',
  'earthquake',
  'draft',
  '{
    "one": "estado",
    "many": "estados"
  }'::jsonb,   -- region_noun
  '{
    "zoom": 8,
    "bounds": [
      [
        0.6,
        -73.4
      ],
      [
        12.3,
        -59.8
      ]
    ],
    "center": [
      10.3,
      -67
    ],
    "regionZoom": 9,
    "geocodeCountry": "ve"
  }'::jsonb,   -- geo
  '[
    {
      "lat": 3.9,
      "lng": -65.8,
      "code": "amazonas",
      "name": "Amazonas"
    },
    {
      "lat": 9,
      "lng": -64.3,
      "code": "anzoategui",
      "name": "Anzoátegui"
    },
    {
      "lat": 7,
      "lng": -68.5,
      "code": "apure",
      "name": "Apure"
    },
    {
      "lat": 10.1,
      "lng": -67.3,
      "code": "aragua",
      "name": "Aragua"
    },
    {
      "lat": 8.3,
      "lng": -70,
      "code": "barinas",
      "name": "Barinas"
    },
    {
      "lat": 5.8,
      "lng": -63.5,
      "code": "bolivar",
      "name": "Bolívar"
    },
    {
      "lat": 10.2,
      "lng": -68.1,
      "code": "carabobo",
      "name": "Carabobo"
    },
    {
      "lat": 9.3,
      "lng": -68.4,
      "code": "cojedes",
      "name": "Cojedes"
    },
    {
      "lat": 9,
      "lng": -61.3,
      "code": "delta_amacuro",
      "name": "Delta Amacuro"
    },
    {
      "lat": 10.49,
      "lng": -66.88,
      "code": "distrito_capital",
      "name": "Distrito Capital",
      "zoom": 12
    },
    {
      "lat": 11.2,
      "lng": -69.8,
      "code": "falcon",
      "name": "Falcón"
    },
    {
      "lat": 8.9,
      "lng": -66.4,
      "code": "guarico",
      "name": "Guárico"
    },
    {
      "lat": 10.6,
      "lng": -66.9,
      "code": "la_guaira",
      "name": "La Guaira",
      "zoom": 11
    },
    {
      "lat": 10.1,
      "lng": -69.8,
      "code": "lara",
      "name": "Lara"
    },
    {
      "lat": 8.5,
      "lng": -71.2,
      "code": "merida",
      "name": "Mérida"
    },
    {
      "lat": 10.3,
      "lng": -66.4,
      "code": "miranda",
      "name": "Miranda"
    },
    {
      "lat": 9.4,
      "lng": -63.2,
      "code": "monagas",
      "name": "Monagas"
    },
    {
      "lat": 11,
      "lng": -63.9,
      "code": "nueva_esparta",
      "name": "Nueva Esparta"
    },
    {
      "lat": 9.1,
      "lng": -69.3,
      "code": "portuguesa",
      "name": "Portuguesa"
    },
    {
      "lat": 10.4,
      "lng": -63.5,
      "code": "sucre",
      "name": "Sucre"
    },
    {
      "lat": 7.8,
      "lng": -72.2,
      "code": "tachira",
      "name": "Táchira"
    },
    {
      "lat": 9.3,
      "lng": -70.5,
      "code": "trujillo",
      "name": "Trujillo"
    },
    {
      "lat": 10.3,
      "lng": -68.8,
      "code": "yaracuy",
      "name": "Yaracuy"
    },
    {
      "lat": 10,
      "lng": -71.8,
      "code": "zulia",
      "name": "Zulia"
    }
  ]'::jsonb,   -- regions
  '{
    "dataLaw": "los artículos 28 y 60 de la Constitución y la LOPNNA (art. 65)",
    "controller": "HelpMaps Venezuela — Tropical Sadness x Imágenes Nacionales",
    "jurisdiction": "Venezuela",
    "privacyEmail": "info@helpmapvzla.net"
  }'::jsonb,   -- legal
  '{
    "logo": "/Venezuela.png",
    "contact": {
      "email": "info@helpmapvzla.net",
      "whatsapp": "",
      "instagram": ""
    }
  }'::jsonb,   -- brand
  '{}'::jsonb,   -- features
  '{
    "overrides": {
      "en": {
        "map.regionOne": "State",
        "map.allRegions": "All states"
      }
    }
  }'::jsonb,   -- language
  '{
    "seismic": {
      "bounds": [
        [
          8,
          -72.5
        ],
        [
          12,
          -61.5
        ]
      ],
      "windowDays": 180,
      "minMagnitude": 3.5
    }
  }'::jsonb,   -- hazard
  '[]'::jsonb,   -- layers
  '{
    "feeds": [
      {
        "id": "elpais",
        "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada",
        "name": "El País (América)"
      },
      {
        "id": "rt",
        "url": "https://actualidad.rt.com/feeds/all.rss",
        "name": "RT (Russia Today)"
      },
      {
        "id": "aporrea",
        "url": "http://feeds.feedburner.com/aporrea/noticias",
        "name": "Aporrea"
      },
      {
        "id": "dw",
        "url": "https://rss.dw.com/xml/rss-es-all",
        "name": "DW (Deutsche Welle)"
      },
      {
        "id": "lanacion",
        "url": "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml",
        "name": "La Nación"
      },
      {
        "id": "nytimes",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        "name": "New York Times (World)"
      },
      {
        "id": "caracaschronicles",
        "url": "https://caracaschronicles.com/feed",
        "name": "Caracas Chronicles"
      },
      {
        "id": "eldiario",
        "url": "https://eldiario.com/feed/",
        "name": "El Diario"
      },
      {
        "id": "efectococuyo",
        "url": "https://efectococuyo.com/feed/",
        "name": "Efecto Cocuyo"
      },
      {
        "id": "elnacional",
        "url": "https://www.elnacional.com/feed/",
        "name": "El Nacional"
      },
      {
        "id": "bbcmundo",
        "url": "https://feeds.bbci.co.uk/mundo/rss.xml",
        "name": "BBC Mundo"
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
      ],
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
      ]
    },
    "refreshHours": 4
  }'::jsonb   -- news
)
on conflict (slug) do nothing;


-- ===========================================================================
-- Lo que hay que cambiar para OTRO país, y lo que se rompe si no
-- ===========================================================================
--
-- `host`          El dominio EXACTO que ve el servidor, sin esquema y en minúsculas.
--                 Ojo con el `www`: si el apex redirige (308) hacia `www`, el único host
--                 que la aplicación llega a ver es el de `www`. Poner el apex no da
--                 error — simplemente no casa ninguna fila, y la resolución cae a un
--                 camino de reserva que funciona mientras haya UNA sola emergencia activa
--                 y deja de funcionar sin aviso el día que haya dos.
--
--                 Y el `host` del preset (`config/presets/<pais>.ts`) tiene que decir LO
--                 MISMO. Esta fila decide contra qué se casa el `Host` de cada petición;
--                 el del preset decide qué URL se ACUÑA — canonicals, sitemap, enlaces
--                 compartidos y el `redirectTo` de los correos. Si difieren, el host
--                 canónico cambia el día que publiques, y como Supabase valida el
--                 `redirectTo` como cadena contra su lista blanca, hay que meter las dos
--                 variantes de cada ruta para cubrir los dos estados. Con los dos campos
--                 de acuerdo, un solo host y la mitad de entradas.
--
-- `geo`           `center` y `bounds` en orden [lat, lng] — el de Leaflet, que es el mapa
--                 2D. `geocodeCountry` es el ISO alpha-2 en minúsculas.
--
-- `regions`       Cada división de primer nivel con un centroide aproximado. Sólo mueven
--                 el encuadre al filtrar, así que "aproximado" está bien de verdad.
--
-- `legal`         `controller` es la organización que responde legalmente por estos datos
--                 personales, y la dirección a la que escribe quien quiere que lo
--                 corrijan o lo saquen. Apuntar a otra organización manda esas solicitudes
--                 a una bandeja ajena por datos que no opera.
--
-- `hazard`        Los umbrales sísmicos. `bounds` acá NO es la silueta del país: es su
--                 cinturón sísmico. Sin él se hereda el encuadre del mapa, que es un
--                 rectángulo generoso y mete los sismos del vecino — en Venezuela eran 22
--                 de 52. `windowDays` tiene que alcanzar al evento principal sin pasarse
--                 de `maxEvents` (60), porque ese corte es silencioso.
--
-- `news`          Los medios y el filtro de relevancia. Vacío = sin boletín, y la interfaz
--                 no muestra la pestaña. El filtro cruza DOS listas —una palabra de
--                 emergencia Y una de lugar— porque sólo emergencia llena el boletín de
--                 terremotos en Japón, y sólo lugar lo llena de cualquier noticia que
--                 mencione la capital.
--
-- `features`      Vacío hereda lo que ofrece la red (`config/features.ts`). Una función se
--                 enciende cuando ya existe el dato que la sustenta, no antes.
--
-- ===========================================================================
-- La sísmica de Venezuela, con las mediciones que la justifican
-- ===========================================================================
--
-- Los valores de `hazard` de arriba no son un ajuste al gusto: cada uno se midió contra
-- USGS. Si copias este archivo para otro país, mide los tuyos — los de aquí no sirven allí.
--
-- EL EVENTO. El terremoto de Venezuela de 2026 es el M7.5 del 24 de junio, 20 km al oeste
-- de Catia La Mar (USGS `us6000t7zp`), con un M7.2 el mismo día junto a San Felipe y una
-- secuencia de réplicas que llega hasta agosto.
--
-- `windowDays: 180`  Con el valor heredado (14) ese sismo era INVISIBLE: ocurrió hace más
--                    de dos meses y ni entraba en la consulta. La ventana tiene que
--                    alcanzarlo sin pasarse de `maxEvents` (60), porque ese corte es
--                    SILENCIOSO — trunca la lista y el mapa queda a medias sin avisar:
--
--                        ventana   M3.5+   M4.5+
--                         90 d      38      22
--                        180 d      52      26     ← cabe
--                        240 d      64      32     ← pasa del tope
--
--                    ⚠️ HACIA EL 21 DE DICIEMBRE DE 2026 la ventana deja de alcanzar al
--                    24 de junio y el evento principal desaparece del mapa solo, sin que
--                    nadie toque nada. Cuando se acerque hay que subir la ventana Y
--                    `maxEvents` A LA VEZ; subir sólo la ventana hace que el tope corte
--                    por arriba y ocurra lo mismo.
--
-- `minMagnitude`     3.5, no el 4.5 heredado, que está calibrado para un margen de
--     : 3.5          subducción y deja fuera las réplicas M3.5–M4 — casi toda la secuencia.
--
-- `bounds`           El CINTURÓN SÍSMICO, no la silueta del país. Sin esta caja se hereda
--                    el encuadre del mapa, que existe para otra cosa y es generoso:
--
--                        encuadre del país      30/30 propios,  22 de fuera
--                        envolvente de estados  30/30,           3 de fuera
--                        este cinturón          30/30,           0 de fuera
--
--                    Ningún rectángulo derivado de la FORMA del país los separa, porque la
--                    sismicidad no sigue fronteras. El intercambio: deja fuera el escudo
--                    guayanés, que es asísmico.
--
-- `contourMinMagnitude` se queda en el 6 de la base: el M7.5 lo pasa de sobra y tiene
-- ShakeMap publicado, que es lo que permite dibujar la huella real de sacudida. Bajarlo no
-- serviría de nada donde no hay ShakeMap — `useQuakes.ts` lo exige además del umbral.


-- ===========================================================================
-- El primer superadmin
-- ===========================================================================
--
-- No se puede crear desde la aplicación, por la misma razón que el primer admin: haría
-- falta ser uno para hacerlo. Crea la cuenta en Authentication → Users y después:
--
--   insert into public.staff_users (user_id, role, email)
--   select id, 'superadmin', email from auth.users where email = 'tu@correo.net'
--   on conflict (user_id) do update set role = 'superadmin';
--
-- Un superadmin no necesita filas en `staff_emergencies`: las políticas preguntan
-- `is_superadmin()` en lugar de mirar la membresía, así que las alcanza todas.
--
-- ⚠️ Y apaga el registro público en Supabase: Authentication → Sign In / Providers →
-- "Allow new users to sign up" en OFF. La aplicación tiene su propia ruta de registro
-- (`/api/account/register`) con límite por IP, comprobación de contraseña filtrada y sin
-- revelar si una dirección ya existe. Dejar las dos puertas abiertas anula las tres cosas.


-- ===========================================================================
-- PUBLICAR — el único paso de todo el archivo que un visitante puede notar
-- ===========================================================================
--
-- Va comentado a propósito: correr este archivo entero NUNCA debe publicar. Se descomenta
-- cuando se decide anunciar, y no antes.
--
-- A partir de esa línea el dominio sirve LA FILA y no el preset compilado: aparecen el
-- boletín, las capas, la escena 3D si hay puntos, y la marca y el aviso legal de la fila.
--
-- Para volver atrás: `update public.emergencies set status = 'draft' where slug = …`.
-- El sitio vuelve al preset en cuanto expire la caché en memoria de 60 segundos de
-- `src/server/emergency.ts`. No hace falta redesplegar.
--
-- Los dos guardias de abajo existen porque los dos fallos ya ocurrieron: publicar con
-- capas de demostración puestas, y publicar con la marca a medias.
-- ===========================================================================

-- do $$
-- declare demo int; fila record;
-- begin
--   select count(*) into demo
--     from public.emergencies e, lateral jsonb_array_elements(e.layers) l
--    where e.slug = 've-terremoto-2026' and l->>'label' like 'DEMO —%';
--   if demo > 0 then
--     raise exception 'Hay % capa(s) de demostración cargadas. No se publica sobre datos sintéticos.', demo;
--   end if;
--
--   select host, brand->>'logo' as logo, legal->>'controller' as responsable into fila
--     from public.emergencies where slug = 've-terremoto-2026';
--   if fila is null      then raise exception 'No existe la emergencia: corré antes el insert de arriba.'; end if;
--   if fila.host is null then raise exception 'La fila no declara `host`.'; end if;
--   if fila.logo is null then raise exception 'La fila no declara logo: se publicaría sin isotipo.'; end if;
-- end $$;
--
-- update public.emergencies set status = 'active' where slug = 've-terremoto-2026';


-- ===========================================================================
-- Verificación
--
--   select slug, status, host,
--          brand->>'logo'                      as logo,
--          legal->>'controller'                as responsable,
--          jsonb_array_length(regions)         as estados,
--          jsonb_array_length(layers)          as capas,
--          jsonb_array_length(news->'feeds')   as medios,
--          hazard->'seismic'                   as sismica
--     from public.emergencies;
--
-- Y después, siempre, `03_verificacion.sql`.
-- ===========================================================================
