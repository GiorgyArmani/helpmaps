-- HelpMaps · datos de demostración — OPCIONAL. NO correr en producción.
--
-- Requiere `db/900_seed_venezuela.sql` (crea la emergencia a la que cuelgan estas filas).
-- Idempotente.
--
-- ---------------------------------------------------------------------------
-- Por qué están marcados como DEMO en el propio nombre
--
-- Esto es un mapa de emergencia: una captura de pantalla se comparte por WhatsApp sin
-- contexto y llega a alguien que necesita ayuda de verdad. Un refugio inventado con
-- coordenadas reales manda a una familia a una dirección donde no hay nadie, y el
-- prefijo del nombre es lo único que viaja con la imagen.
--
-- Por eso, además de que la emergencia está en `draft` y no la sirve ningún host:
--   • cada punto se llama "DEMO — ..."
--   • `source` es 'demo' en todas las filas
--   • no hay un solo teléfono real: todos son 0000-000-0000
--
-- Las coordenadas sí son reales, porque un mapa de prueba con puntos en el mar no
-- prueba nada: hay que ver la agrupación, el encuadre y los filtros por estado.
--
-- ---------------------------------------------------------------------------
-- Qué cubre este conjunto
--
-- Está armado para que ninguna superficie quede vacía y para que los casos difíciles
-- estén representados desde el primer día:
--
--   • los cinco tipos de punto encendidos (morgue está apagada en config/map.ts)
--   • estado abierto, lleno, cerrado, y NULL (desconocido) — el caso que nada puede
--     mostrar como "abierto"
--   • un punto sin confirmar hace mucho, para ver el aviso de posiblemente desactualizado
--   • un refugio de animales (`is_animal`), para que no se mezcle con los de personas
--   • un punto de la diáspora (`country_code` distinto al de la emergencia)
--   • puntos con y sin necesidad declarada, para el filtro y el corazón del pin
-- ---------------------------------------------------------------------------

-- La emergencia a la que cuelga todo esto.
create temporary table if not exists _e as
  select id from public.emergencies where slug = 've-terremoto-2026';


-- ===========================================================================
-- Puntos
-- ===========================================================================

insert into public.locations
  (id, emergency_id, name, type, region, municipality, lat, lng, address, phone, whatsapp, country_code, active)
select v.id, (select id from _e), v.name, v.type, v.region, v.municipality,
       v.lat, v.lng, v.address, v.phone, v.whatsapp, v.country_code, v.active
from (values
  ('demo-ref-01', 'DEMO — Refugio Escuela Bolivariana', 'shelter',
   'la_guaira', 'Catia La Mar', 10.5985, -67.0245,
   'Av. Principal, Catia La Mar', '0000-000-0000', '0000-000-0000', null, true),

  ('demo-ref-02', 'DEMO — Refugio Polideportivo Norte', 'shelter',
   'distrito_capital', 'Libertador', 10.5061, -66.9146,
   'Parroquia Sucre, Caracas', '0000-000-0000', null, null, true),

  ('demo-ref-03', 'DEMO — Refugio Animal Los Palos', 'shelter',
   'miranda', 'Chacao', 10.4972, -66.8543,
   'Sector Los Palos Grandes', '0000-000-0000', null, null, true),

  ('demo-aco-01', 'DEMO — Acopio Plaza Central', 'donation_centre',
   'distrito_capital', 'Libertador', 10.5000, -66.9036,
   'Plaza central, Caracas', '0000-000-0000', '0000-000-0000', null, true),

  ('demo-aco-02', 'DEMO — Acopio Galpón Industrial', 'donation_centre',
   'carabobo', 'Valencia', 10.1620, -68.0077,
   'Zona industrial, Valencia', '0000-000-0000', null, null, true),

  ('demo-aco-03', 'DEMO — Acopio Parroquia San José', 'donation_centre',
   'aragua', 'Girardot', 10.2469, -67.5958,
   'Maracay', null, null, null, true),

  ('demo-com-01', 'DEMO — Comedor Comunitario El Valle', 'comedor',
   'distrito_capital', 'Libertador', 10.4620, -66.9200,
   'El Valle, Caracas', '0000-000-0000', null, null, true),

  ('demo-com-02', 'DEMO — Olla Solidaria La Guaira', 'comedor',
   'la_guaira', 'Maiquetía', 10.6010, -66.9800,
   'Maiquetía', null, null, null, true),

  ('demo-ini-01', 'DEMO — Brigada Vecinal de Rescate', 'iniciativa',
   'la_guaira', 'Catia La Mar', 10.6035, -67.0100,
   'Punto de encuentro, Catia La Mar', '0000-000-0000', null, null, true),

  ('demo-ini-02', 'DEMO — Colectivo Transporte Solidario', 'iniciativa',
   'miranda', 'Baruta', 10.4400, -66.8750,
   'Baruta', null, null, null, true),

  ('demo-hos-01', 'DEMO — Hospital de Campaña Litoral', 'hospital',
   'la_guaira', 'Catia La Mar', 10.5950, -67.0400,
   'Catia La Mar', '0000-000-0000', null, null, true),

  -- Diáspora: recoge PARA Venezuela desde fuera del país. Su `country_code` no coincide
  -- con el de la emergencia, así que no es un lugar al que mandar a alguien del litoral.
  ('demo-dia-01', 'DEMO — Acopio Diáspora Madrid', 'donation_centre',
   null, 'Madrid', 40.4168, -3.7038,
   'Madrid, España', null, null, 'ES', true)
) as v(id, name, type, region, municipality, lat, lng, address, phone, whatsapp, country_code, active)
on conflict (id) do nothing;


-- ===========================================================================
-- Qué recibe y qué necesita cada punto
--
-- `status` NULL en demo-aco-03 es deliberado: es el caso que ninguna capa puede pintar
-- como abierto, y si alguna vez se rompe, se rompe aquí primero.
-- ===========================================================================

insert into public.center_info
  (location_id, status, receives, needs, help, category, description, schedule,
   contact_name, is_animal, last_confirmed_at, source)
select v.location_id, v.status::text, v.receives::text[], v.needs, v.help::text[],
       v.category, v.description, v.schedule, v.contact_name, v.is_animal,
       v.confirmed::timestamptz, 'demo'
from (values
  ('demo-ref-01', 'abierto', array['agua','alimentos','higiene'],
   'Colchonetas y agua potable para 40 personas', array['voluntariado','especie'],
   null, 'Refugio habilitado en la escuela. Capacidad aproximada 60 personas.',
   'Abierto 24 horas', 'Coordinación DEMO', false, now() - interval '2 hours'),

  ('demo-ref-02', 'lleno', array['ropa','alimentos'],
   null, array['difusion'],
   null, 'Refugio a capacidad completa.', 'Lunes a domingo, 6:00 a 22:00',
   'Coordinación DEMO', false, now() - interval '1 day'),

  ('demo-ref-03', 'abierto', array['alimentos'],
   'Alimento para perros y gatos, jaulas de transporte', array['voluntariado','especie'],
   'rescate animal', 'Refugio para animales rescatados. No recibe personas.',
   '8:00 a 18:00', 'Coordinación DEMO', true, now() - interval '5 hours'),

  ('demo-aco-01', 'abierto', array['agua','alimentos','medicinas','higiene','ropa'],
   'Medicinas de primeros auxilios', array['especie','voluntariado','difusion'],
   null, 'Centro de acopio principal.', '8:00 a 17:00',
   'Coordinación DEMO', false, now() - interval '30 minutes'),

  -- Sin confirmar hace 20 días: por encima de `staleAfterDays` (10 en config/map.ts).
  -- Debe aparecer marcado como posiblemente desactualizado, con la sugerencia de llamar.
  ('demo-aco-02', 'abierto', array['alimentos','ropa'],
   'Voluntarios para clasificar donaciones', array['voluntariado'],
   null, 'Galpón habilitado para recepción y clasificación.', '9:00 a 16:00',
   'Coordinación DEMO', false, now() - interval '20 days'),

  -- Estado desconocido: nunca se muestra como abierto.
  ('demo-aco-03', null, array['agua'],
   null, array[]::text[],
   null, 'Punto reportado por la comunidad, sin confirmar todavía.', null,
   null, false, null),

  ('demo-com-01', 'abierto', array['alimentos'],
   'Gas para cocinar y arroz', array['voluntariado','especie'],
   'comedor comunitario', 'Almuerzo diario para el sector.', '11:00 a 14:00',
   'Coordinación DEMO', false, now() - interval '6 hours'),

  ('demo-com-02', 'cerrado', array['alimentos'],
   null, array[]::text[],
   'comedor comunitario', 'Cerrado temporalmente por falta de insumos.', null,
   null, false, now() - interval '3 days'),

  ('demo-ini-01', 'abierto', array[]::text[],
   'Cascos, guantes y linternas', array['voluntariado','oficios','difusion'],
   'rescate y remoción de escombros',
   'Brigada vecinal organizada para remoción de escombros.', 'Turnos de 6:00 a 18:00',
   'Coordinación DEMO', false, now() - interval '4 hours'),

  ('demo-ini-02', 'abierto', array[]::text[],
   'Combustible y conductores voluntarios', array['voluntariado','oficios'],
   'transporte', 'Traslado gratuito de insumos entre acopios.', null,
   'Coordinación DEMO', false, now() - interval '2 days'),

  ('demo-hos-01', 'abierto', array['medicinas','higiene'],
   'Insumos de sutura y analgésicos', array['oficios','especie'],
   null, 'Atención de urgencias y primeros auxilios.', '24 horas',
   'Coordinación DEMO', false, now() - interval '1 hour'),

  ('demo-dia-01', 'abierto', array['alimentos','ropa','higiene'],
   'Contenedores para envío marítimo', array['especie','difusion','economico'],
   null, 'Punto de recolección en el exterior. Envíos consolidados.', 'Sábados 10:00 a 14:00',
   'Coordinación DEMO', false, now() - interval '3 days')
) as v(location_id, status, receives, needs, help, category, description, schedule,
       contact_name, is_animal, confirmed)
on conflict (location_id) do nothing;


-- ===========================================================================
-- Teléfonos de emergencia
-- ===========================================================================

insert into public.emergency_phones (emergency_id, name, number, description, region, sort)
select (select id from _e), v.name, v.number, v.description, v.region, v.sort
from (values
  ('DEMO — Emergencias nacionales', '0000-000-0000', 'Línea única de emergencia', null, 1),
  ('DEMO — Protección Civil', '0000-000-0000', 'Reporte de daños y rescate', null, 2),
  ('DEMO — Bomberos La Guaira', '0000-000-0000', 'Atención en el litoral', 'la_guaira', 3)
) as v(name, number, description, region, sort)
where not exists (
  select 1 from public.emergency_phones p
  where p.emergency_id = (select id from _e) and p.name = v.name
);


-- ===========================================================================
-- Directorio de donaciones y cola de sugerencias
--
-- Una sugerencia pendiente para que la cola del panel no esté vacía: revisar y publicar
-- es el flujo que hay que poder probar de punta a punta.
-- ===========================================================================

insert into public.donations (id, emergency_id, name, description, social_url, donate_info, sort, active)
values (
  '00000000-0000-4000-8000-000000000001',
  (select id from _e),
  'DEMO — Fundación de ejemplo',
  'Organización de demostración para probar el directorio de donaciones.',
  'https://example.org',
  'Datos de transferencia de ejemplo. No es una cuenta real.',
  1, true
) on conflict (id) do nothing;

insert into public.submissions (id, emergency_id, kind, message, name, contact, status)
values (
  '00000000-0000-4000-8000-000000000002',
  (select id from _e),
  'center',
  'DEMO — Sugerencia de ejemplo: hay un acopio nuevo en la calle 5, abre de 9 a 15.',
  'Vecina de ejemplo',
  'demo@example.org',
  'pending'
) on conflict (id) do nothing;


-- ===========================================================================
-- Capas de demostración
--
-- Dos públicas y una servida por el propio despliegue, para poder ver los tres tipos que
-- `src/domain/layers.ts` soporta sin depender de ninguna clave de API.
--
-- La de edificios apunta a una ruta relativa: el archivo viaja en `public/demo/` y no hay
-- dominio de terceros que se pueda caer. Es el mismo patrón con el que AcopioVE sirve su
-- instantánea de daños de Catia La Mar.
-- ===========================================================================

update public.emergencies set layers = '[
  {
    "id": "usgs-recientes",
    "label": "DEMO — Sismos recientes",
    "hint": "Magnitud 2.5+ de las últimas 24 horas",
    "kind": "geojson",
    "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
    "attribution": "Datos: USGS",
    "color": "#b3261e",
    "defaultOn": false
  },
  {
    "id": "relieve",
    "label": "DEMO — Capa de teselas",
    "hint": "Ejemplo de superposición raster",
    "kind": "tiles",
    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    "attribution": "© OpenStreetMap",
    "opacity": 0.35,
    "defaultOn": false
  },
  {
    "id": "edificios",
    "label": "DEMO — Daños en edificios",
    "hint": "Conjunto sintético de 81 edificios en Catia La Mar",
    "kind": "buildings3d",
    "url": "/demo/edificios-demo.geojson",
    "attribution": "Datos sintéticos de demostración",
    "heightProperty": "dano",
    "center": [-67.0190, 10.6022],
    "zoom": 16,
    "color": "#b3261e"
  }
]'::jsonb
where slug = 've-terremoto-2026';

-- ===========================================================================
-- Verificación
--   select type, count(*) from public.locations group by 1 order by 1;
--   select l.name, ci.status from public.locations l
--     left join public.center_info ci on ci.location_id = l.id order by 1;
-- ===========================================================================
