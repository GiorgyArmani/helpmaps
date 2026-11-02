-- ===========================================================================
-- db/22_bienvenida.sql — HelpMaps da la bienvenida a cada organización que llega
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `026_bienvenida` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro. Necesita db/21_helpmaps_oficial.sql.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Una columna, un cambio de `check` y un trigger.
--
-- POR QUÉ
--
-- El perfil de HelpMaps es el espacio desde el que la plataforma habla a la comunidad, y
-- una de las cosas que más tiene que contar es quién se suma. Cuando el equipo aprueba una
-- organización registrada en `/organizaciones`, HelpMaps publica «X ya está en HelpMaps»
-- con una tarjeta que lleva a su perfil para seguirla.
--
-- Lo hace la BASE y no la pantalla: cuelga del hecho —la sugerencia pasa a «approved» con
-- su punto— igual que `reward_approved_submission`. Así no depende de que nadie se acuerde
-- de publicarlo, ni de qué botón se usó para aprobar.
--
-- QUÉ AÑADE
--
-- 1. `initiative_posts.featured_location_id`: la organización de la que habla una entrada.
--    `on delete cascade`: si se borra ese punto, una bienvenida a algo que ya no existe
--    mandaría a la gente a un 404.
--
-- 2. `kind = 'bienvenida'`. El texto que se ve lo pone la app en el idioma de quien lee;
--    `body` lleva una versión en castellano para la API y para clientes viejos.
--
-- 3. `welcome_approved_org`: al aprobarse un registro de `/organizaciones`
--    (`payload.org = true`) con su punto, una entrada del perfil oficial. Una sola por
--    organización, aunque la sugerencia se apruebe dos veces. Sin perfil oficial no hace
--    nada.
--
-- No publica bienvenidas a las organizaciones aprobadas antes de correr esto.
-- ===========================================================================

alter table public.initiative_posts
  add column if not exists featured_location_id text
    references public.locations(id) on delete cascade;

create index if not exists initiative_posts_featured_idx
  on public.initiative_posts (featured_location_id) where featured_location_id is not null;

alter table public.initiative_posts drop constraint if exists initiative_posts_kind_check;
alter table public.initiative_posts add constraint initiative_posts_kind_check
  check (kind in ('avance','entrega','necesidad','bienvenida'));

create or replace function public.welcome_approved_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $welcome$
declare
  v_official text;
  v_name     text;
begin
  if new.status <> 'approved'
     or old.status is not distinct from 'approved'
     or new.location_id is null
     or coalesce(new.payload->>'org', '') <> 'true' then
    return new;
  end if;

  select id into v_official from public.locations where official and active limit 1;
  if v_official is null or v_official = new.location_id then
    return new;
  end if;

  if exists (
    select 1 from public.initiative_posts
     where location_id = v_official and featured_location_id = new.location_id
  ) then
    return new;
  end if;

  select name into v_name from public.locations where id = new.location_id;
  if v_name is null then
    return new;
  end if;

  insert into public.initiative_posts (location_id, kind, body, featured_location_id, status)
  values (
    v_official,
    'bienvenida',
    left(v_name, 200) || ' ya está en HelpMaps. Síguela para enterarte de sus campañas y jornadas.',
    new.location_id,
    'published'
  );
  return new;
end
$welcome$;

drop trigger if exists trg_submissions_welcome on public.submissions;
create trigger trg_submissions_welcome after update on public.submissions
  for each row execute function public.welcome_approved_org();

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verificación
--
--   select kind, body, featured_location_id, created_at
--     from public.initiative_posts where kind = 'bienvenida' order by created_at desc;
--   -- después de aprobar un registro de /organizaciones: una fila nueva.
-- ---------------------------------------------------------------------------
