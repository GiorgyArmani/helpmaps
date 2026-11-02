-- ===========================================================================
-- db/21_helpmaps_oficial.sql — HelpMaps publica con su propia voz
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `025_helpmaps_oficial` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Una columna, un índice, un trigger y una
-- función.
--
-- POR QUÉ HACÍA FALTA
--
-- Cuando el equipo necesita avisar de algo grave —un cierre, una alerta, una jornada
-- nacional— no tenía dónde decirlo: las publicaciones, campañas y eventos cuelgan siempre
-- de un punto, y el feed los ordena por cercanía. Un aviso del equipo quedaba enterrado o,
-- con una zona abierta, fuera de la lista.
--
-- QUÉ AÑADE
--
-- 1. `locations.official`: el perfil de HelpMaps es UN PUNTO MÁS —tipo `digital`, sin
--    coordenadas— marcado como oficial. Así reusa todo lo que ya existe: su página
--    `/c/<id>`, el editor de perfil, publicaciones, campañas, eventos, seguir. El equipo
--    ya puede escribir en cualquier punto (`can_manage_location` → `can_edit`), así que
--    no hace falta ninguna política nueva para publicar.
--
-- 2. Uno solo por base: índice único parcial. Cada país tiene su base y su perfil.
--
-- 3. Sólo un admin marca o desmarca `official`. Lo decide la base, no la pantalla: un
--    perfil que la app pone arriba del feed de todo el país no lo puede fabricar nadie
--    marcando su propio punto.
--
-- 4. `ensure_official_location(nombre)`: crea el perfil si no existe y devuelve su id.
--    La llama el panel del equipo. El nombre lo manda la app (`BRAND.name`), porque la
--    marca de cada país vive en su configuración y no en esta base.
--
-- MIENTRAS NO SE CORRA, la app funciona igual: no hay perfil oficial y el feed no cambia.
-- La pestaña del panel lo dice y no ofrece un botón que vaya a fallar.
-- ===========================================================================

alter table public.locations
  add column if not exists official boolean not null default false;

create unique index if not exists locations_one_official
  on public.locations ((true)) where official;

-- ── Sólo un admin decide qué punto es la voz de HelpMaps ─────────────────────

create or replace function private.guard_official()
returns trigger
language plpgsql
set search_path = public
as $guard$
begin
  if (tg_op = 'INSERT' and new.official)
     or (tg_op = 'UPDATE' and new.official is distinct from old.official) then
    if not private.is_admin() then
      raise exception 'Sólo un admin puede marcar el perfil oficial' using errcode = '42501';
    end if;
  end if;
  return new;
end
$guard$;

drop trigger if exists trg_locations_official on public.locations;
create trigger trg_locations_official before insert or update on public.locations
  for each row execute function private.guard_official();

-- ── Crear el perfil (o devolver el que ya hay) ────────────────────────────

create or replace function public.ensure_official_location(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $ensure$
declare
  v_id text;
begin
  if not private.is_admin() then
    raise exception 'Sólo un admin puede crear el perfil oficial' using errcode = '42501';
  end if;

  select id into v_id from public.locations where official limit 1;
  if v_id is not null then
    return v_id;
  end if;

  v_id := 'helpmaps-oficial';
  insert into public.locations (id, name, type, active, official)
  values (v_id, coalesce(nullif(btrim(p_name), ''), 'HelpMaps'), 'digital', true, true)
  on conflict (id) do update set official = true, active = true;

  -- `onboarded_at` ya puesto: el equipo entra directo al editor del perfil, sin el
  -- recorrido de bienvenida pensado para una organización que llega por primera vez.
  insert into public.center_info (location_id, status, onboarded_at)
  values (v_id, 'abierto', now())
  on conflict (location_id) do update
    set onboarded_at = coalesce(public.center_info.onboarded_at, now());

  return v_id;
end
$ensure$;

revoke all on function public.ensure_official_location(text) from public, anon;
grant execute on function public.ensure_official_location(text) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verificación
--
--   select id, name, type, active, official from public.locations where official;
--   -- después de pulsar «Crear el perfil de HelpMaps» en el panel: una fila.
-- ---------------------------------------------------------------------------
