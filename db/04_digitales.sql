-- ===========================================================================
-- db/04_digitales.sql — iniciativas sin sede física
-- ---------------------------------------------------------------------------
-- Idempotente. Para un proyecto que ya corrió db/01_esquema.sql antes de que existiera
-- la sección `011_digitales`: este archivo es esa sección, sola, para aplicarla encima.
-- Un proyecto nuevo no lo necesita — 01_esquema.sql ya la trae al final.
--
-- QUÉ CAMBIA Y POR QUÉ
--
-- Hasta ahora todo `locations` era un sitio al que ir: lat/lng obligatorios. Hay
-- iniciativas reales que no tienen local —redes de voluntarios remotos, líneas de
-- apoyo, campañas que reparten en varias zonas— y quedaban fuera del mapa.
--
-- Entran como tipo `digital`, sin coordenadas, y con la lista de regiones (códigos del
-- preset / `emergencies.regions`) y municipios donde prestan ayuda. La app las dibuja en
-- el centroide de cada región atendida como MARCADOR DE COBERTURA, no como pin: nadie
-- tiene que viajar a ese punto. Lista vacía = todo el país.
--
-- Arrays y no tabla de unión: las regiones son códigos resueltos contra un JSON, no hay a
-- qué hacer FK. `center_info.help` ya sienta el precedente y la app filtra en cliente.
--
-- Los enlaces (`website`, `instagram`) van en `center_info` como columnas explícitas: la
-- capa de datos nunca hace `select *`, así que una columna nueva no viaja al cliente
-- hasta que alguien la lista a propósito.
-- ===========================================================================

-- 1) El tipo nuevo
alter table public.locations drop constraint if exists locations_type_check;
alter table public.locations add constraint locations_type_check
  check (type in ('shelter','donation_centre','comedor','iniciativa','hospital','morgue','digital'));

-- 2) Coordenadas opcionales SOLO para `digital`. Cualquier otro tipo sigue exigiéndolas:
--    un refugio sin coordenadas no es un refugio al que alguien pueda llegar.
alter table public.locations alter column lat drop not null;
alter table public.locations alter column lng drop not null;
alter table public.locations drop constraint if exists locations_coords_required;
alter table public.locations add constraint locations_coords_required
  check (type = 'digital' or (lat is not null and lng is not null));

-- 3) Dónde ayuda
alter table public.locations
  add column if not exists coverage_regions text[] not null default '{}';
alter table public.locations
  add column if not exists coverage_municipalities text[] not null default '{}';

-- Solo la API pública filtra por región en servidor; la app carga todo y filtra en cliente.
create index if not exists locations_coverage_regions_idx
  on public.locations using gin (coverage_regions) where type = 'digital';

-- 4) Enlaces. `social_url` se queda como "otra red"; `whatsapp` sigue en `locations`.
alter table public.center_info add column if not exists website text;
alter table public.center_info add column if not exists instagram text;

-- RLS: nada que tocar. Lectura pública `using (true)`; las políticas de escritura se
-- deciden por `emergency_id` e `is_staff()`, no por columnas. `audit_row()` solo lee
-- `name` y `needs`, así que una fila sin coordenadas se audita igual.

-- ---------------------------------------------------------------------------
-- Verificación
--
--   select column_name, is_nullable from information_schema.columns
--    where table_name = 'locations' and column_name in ('lat','lng','coverage_regions');
--
--   select count(*) from public.locations where type = 'digital';
-- ---------------------------------------------------------------------------
