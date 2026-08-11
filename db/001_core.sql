-- HelpMaps · esquema base (1 de 4) — corre esto PRIMERO en el proyecto Supabase de este país.
--
-- Idempotente: se puede volver a correr sin romper nada.
--
-- Decisión de diseño que importa al clonar: `locations.region` es TEXT, no un enum.
-- La versión anterior usaba un enum de Postgres por país y agregar una región exigía
-- `ALTER TYPE` antes de poder insertar una sola fila — un bloqueo en plena emergencia.
-- Aquí las regiones válidas viven en `src/country/presets/<pais>.ts` y el panel de staff
-- solo ofrece esas. El costo aceptado: un INSERT hecho a mano por SQL puede escribir una
-- región que la app no conoce; esa fila aparece en el mapa pero no en el filtro por
-- región. La consulta al final de este archivo las encuentra.

-- ---------------------------------------------------------------------------
-- updated_at: se toca solo cuando la fila REALMENTE cambió.
-- Un pipeline que reescribe todas las filas cada 5 minutos, si no, deja "actualizado
-- hace 1 minuto" en puntos que nadie confirmó hace semanas — y esa fecha es justo lo
-- que una familia usa para decidir si el lugar sigue abierto.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and to_jsonb(new) - 'updated_at' is not distinct from to_jsonb(old) - 'updated_at' then
    return old;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- locations — el objetivo de todos los joins: pines, filtros, rutas de detalle.
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id            text primary key,
  name          text not null,
  type          text not null check (type in
                  ('shelter','donation_centre','comedor','iniciativa','hospital','morgue')),
  -- Código de región. Debe coincidir con un `Region.code` del CountryConfig activo.
  region        text,
  municipality  text,
  lat           double precision not null,
  lng           double precision not null,
  address       text,
  phone         text,
  whatsapp      text,
  aliases       text[] not null default '{}',
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists locations_active_idx on public.locations (active) where active;
create index if not exists locations_region_idx on public.locations (region);
create index if not exists locations_type_idx on public.locations (type);

drop trigger if exists trg_locations_touch on public.locations;
create trigger trg_locations_touch before update on public.locations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- center_info — 1:1 con locations: qué RECIBE y qué NECESITA este punto ahora.
--
-- Tabla aparte a propósito: las necesidades cambian a diario, la ubicación casi nunca,
-- y las edita gente distinta con expectativas distintas.
--
-- `status` NULL significa DESCONOCIDO y así debe mostrarse. Nada, en ninguna capa,
-- puede asumir 'abierto' por defecto: decir que un punto cerrado está abierto es el
-- único error de este campo que manda a una familia a una puerta cerrada.
-- ---------------------------------------------------------------------------
create table if not exists public.center_info (
  location_id       text primary key references public.locations(id) on delete cascade,
  status            text check (status in ('abierto','lleno','cerrado')),
  receives          text[] not null default '{}',
  needs             text,
  help              text[] not null default '{}'
                      check (help <@ array['voluntariado','especie','oficios','difusion','economico']::text[]),
  category          text,
  description       text,
  schedule          text,
  contact_name      text,
  social_url        text,
  is_animal         boolean not null default false,
  last_confirmed_at timestamptz,
  source            text,
  external_id       text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists center_info_status_idx on public.center_info (status);

drop trigger if exists trg_center_info_touch on public.center_info;
create trigger trg_center_info_touch before update on public.center_info
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- app_settings — una sola fila. Mantenimiento y aviso global.
--
-- Cuando el equipo baja los datos para reverificarlos, el mapa queda vacío a propósito
-- y sin aviso se lee como "no hay nadie" — alarmante para quien busca ayuda. La app
-- sigue usable: esto es un aviso, nunca un bloqueo.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id          boolean primary key default true check (id),
  maintenance boolean not null default false,
  notice      text,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS — lectura pública, escritura solo de staff (se define en 002_staff.sql).
--
-- Con la app escribiendo directo a estas tablas usando la anon key, RLS es lo ÚNICO
-- que protege los datos. No asumas que está bien: corre db/099_security_check.sql.
-- ---------------------------------------------------------------------------
alter table public.locations   enable row level security;
alter table public.center_info enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists locations_public_read on public.locations;
create policy locations_public_read on public.locations
  for select to anon, authenticated using (true);

drop policy if exists center_info_public_read on public.center_info;
create policy center_info_public_read on public.center_info
  for select to anon, authenticated using (true);

drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read on public.app_settings
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Verificación: filas cuya región la app no conoce (typos de un INSERT manual).
-- Compara este resultado con `regions` en el preset del país.
--   select region, count(*) from public.locations group by 1 order by 2 desc;
-- ---------------------------------------------------------------------------
