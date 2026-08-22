-- HelpMaps · emergencias (7 de 8) — corre esto DESPUÉS de 006_audit_scope.sql.
--
-- Idempotente: se puede volver a correr sin romper nada.
--
-- ---------------------------------------------------------------------------
-- Por qué existe esta tabla
--
-- Hoy el país se resuelve en tiempo de build: `NEXT_PUBLIC_COUNTRY` elige un preset de
-- `config/presets/`, el kit se ensambla y `SITE` queda congelado dentro del bundle. Es
-- correcto para lo que resuelve, pero deja tres cosas fuera de alcance:
--
--   • levantar un país nuevo exige crear proyecto, base, variables y subdominio a mano;
--   • no hay ningún lugar desde donde ver más de una emergencia a la vez;
--   • un mismo país no puede tener dos emergencias distintas (un terremoto este año y
--     una inundación el próximo) sin sobrescribir el preset y perder la anterior.
--
-- Esta tabla es EL MISMO objeto `CountryConfig` que ya define `src/config/types.ts`,
-- guardado como fila y resuelto por host en cada request. No hay traducción de por
-- medio: un preset existente se convierte en una fila campo por campo.
--
-- ---------------------------------------------------------------------------
-- Compatibilidad hacia atrás — esto es lo que hace que la migración sea segura
--
-- Con la tabla VACÍA, la aplicación cae al preset compilado exactamente como hoy. Un
-- despliegue con `NEXT_PUBLIC_COUNTRY=co` y cero filas aquí se comporta igual que antes
-- de esta migración, línea por línea. La tabla solo empieza a mandar cuando alguien
-- inserta la primera fila.
-- ---------------------------------------------------------------------------

create table if not exists public.emergencies (
  id            uuid primary key default gen_random_uuid(),

  -- Identidad. `slug` es el id corto (namespace de caché, nombre de preset equivalente);
  -- `host` es cómo se resuelve esta fila en cada request. Sin host, la fila existe pero
  -- no la sirve ningún dominio: así se prepara una emergencia antes de anunciarla.
  slug          text not null unique,
  host          text unique,

  country_code  text not null,                       -- ISO 3166-1 alpha-2, mayúsculas
  -- Dos nombres distintos y los dos hacen falta: `country_name` es el país que rellena
  -- `CountryConfig.name` ("Venezuela", el que aparece en la marca y los metadatos), y
  -- `name` es el evento ("Terremoto de Venezuela 2026"), que es lo que administra el
  -- panel y lo que distingue dos emergencias del mismo país.
  country_name  text not null,
  name          text not null,

  -- Qué clase de evento es. No es decorativo: decide qué capas de amenaza tienen
  -- sentido ofrecer y qué vocabulario usa la interfaz.
  hazard_type   text not null default 'earthquake'
                  check (hazard_type in
                    ('earthquake','flood','storm','fire','landslide','conflict','other')),

  -- draft    — existe, se puede preparar, no la sirve ningún host todavía.
  -- active   — en vivo.
  -- archived — pasó. Se sigue pudiendo consultar, no se sigue editando.
  status        text not null default 'draft'
                  check (status in ('draft','active','archived')),

  -- ── El kit de configuración, con la forma que ya definen los tipos ──────────
  -- Cada uno de estos jsonb corresponde a un campo de `CountryConfig`. La validación
  -- de forma sigue viviendo en `src/config/validate.ts`, que ahora corre también sobre
  -- lo que sale de aquí: una fila mal armada falla igual que un preset mal armado.
  region_noun   jsonb not null default '{"one":"región","many":"regiones"}'::jsonb,
  geo           jsonb not null,                      -- center, zoom, regionZoom, bounds, geocodeCountry
  regions       jsonb not null default '[]'::jsonb,  -- [{ code, name, lat, lng, zoom }]
  legal         jsonb not null,                      -- controller, privacyEmail, dataLaw, jurisdiction
  brand         jsonb not null default '{}'::jsonb,  -- BrandOverrides
  features      jsonb not null default '{}'::jsonb,  -- Partial<FeatureConfig>
  language      jsonb not null default '{}'::jsonb,  -- LanguageOverrides
  hazard        jsonb not null default '{}'::jsonb,  -- HazardConfig (sísmica USGS)

  -- Capas extra de ESTA emergencia: [{ id, label, kind, url, attribution, defaultOn }].
  -- Las capas que aporta AcopioVE (daño satelital SAR, edificios dañados en 3D, lluvia,
  -- clima, alertas) son específicas de un evento concreto, no de un país: el snapshot de
  -- edificios de Catia La Mar no significa nada en una inundación en otro sitio. Por eso
  -- se declaran por emergencia en vez de compilarse como componentes fijos.
  layers        jsonb not null default '[]'::jsonb,

  -- ── Estado operativo de la emergencia ──────────────────────────────────────
  -- `app_settings` sigue siendo el interruptor de TODA la instalación y no se toca.
  -- Esto es lo mismo pero de UNA emergencia: cuando el equipo de un país baja sus datos
  -- para reverificarlos, su mapa queda vacío a propósito y necesita decirlo, sin apagar
  -- los mapas de los demás países.
  maintenance   boolean not null default false,
  notice        text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Para una tabla creada antes de que existiera `country_name`: la añade sin tocar el
-- resto. `create table if not exists` no altera una tabla que ya está.
alter table public.emergencies add column if not exists country_name text;
update public.emergencies set country_name = name where country_name is null;
alter table public.emergencies alter column country_name set not null;

-- El host es la consulta caliente: se resuelve en cada request antes de servir nada.
-- La unicidad ya crea el índice; este parcial cubre el listado del hub.
create index if not exists emergencies_status_idx on public.emergencies (status)
  where status <> 'draft';

drop trigger if exists trg_emergencies_touch on public.emergencies;
create trigger trg_emergencies_touch before update on public.emergencies
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Lectura pública de lo que no es borrador: es la configuración del sitio (nombre,
-- colores, regiones, encuadre) más el aviso legal, todo lo cual ya viaja hoy dentro del
-- bundle que descarga cualquiera. Los borradores no se publican: preparar una emergencia
-- no debería anunciarla.
--
-- Las políticas de ESCRITURA se definen en 008_tenancy.sql, porque dependen de
-- `is_superadmin()`, que se crea allí. Entre una migración y la otra la tabla queda con
-- RLS activo y sin política de escritura, es decir: nadie escribe. Ese es el lado
-- correcto en el que quedarse a medio camino.
-- ---------------------------------------------------------------------------
alter table public.emergencies enable row level security;

drop policy if exists emergencies_public_read on public.emergencies;
create policy emergencies_public_read on public.emergencies
  for select to anon, authenticated using (status <> 'draft');

drop policy if exists emergencies_staff_read on public.emergencies;
create policy emergencies_staff_read on public.emergencies
  for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Verificación: emergencias activas sin host asignado (no las sirve nadie).
--   select slug, name, status, host from public.emergencies order by status, slug;
-- ---------------------------------------------------------------------------
