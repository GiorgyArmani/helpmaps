-- ===========================================================================
-- db/13_eventos.sql — apuntarse a un evento, y la imagen de una campaña
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `019_eventos` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Crea una tabla nueva y dos columnas; las
-- políticas que añade son de esa tabla y de `profiles`, así que no bloquea las lecturas
-- del mapa.
--
-- QUÉ AÑADE
--
--   1. `activity_attendees`: quién dijo «me apunto» a qué evento. Es la lista que ve la
--      organización para saber cuánta gente viene, y la base sobre la que el QR de
--      reconocimiento confirmará quién vino de verdad. Apuntarse NO da experiencia: es
--      declarado, y la experiencia sólo se gana por lo comprobado.
--
--   2. `activities.going_count`: cuántos van, mantenido por un trigger. Lo lee cualquiera
--      —«12 van» es la prueba social que anima a sumarse— sin abrir quiénes son.
--
--   3. `profiles_attendee_read`: la organización puede leer el NOMBRE de quien se apuntó
--      a UN EVENTO SUYO, igual que ya lee el de quien le declaró un aporte. Nada más.
--
--   4. `campaigns.image_url`: la foto o banner de una campaña. Va al bucket `initiatives`
--      bajo la carpeta del punto, así que la cubre la política de Storage que ya existe.
--
-- MIENTRAS NO SE CORRA la app funciona igual: sin botón de apuntarse, sin contador y sin
-- imagen de campaña.
-- ===========================================================================

-- ── 1. Quién se apunta ─────────────────────────────────────────────────────

create table if not exists public.activity_attendees (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Copiado del evento por trigger, como `emergency_id` en las campañas: es lo que mira
  -- la política de lectura de la organización, y el navegador no tiene por qué mandarlo.
  location_id text references public.locations(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index if not exists activity_attendees_user_idx
  on public.activity_attendees (user_id, created_at desc);
create index if not exists activity_attendees_location_idx
  on public.activity_attendees (location_id);

alter table public.activity_attendees enable row level security;

create or replace function private.set_attendee_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select a.location_id into new.location_id from public.activities a where a.id = new.activity_id;
  return new;
end;
$$;

drop trigger if exists trg_activity_attendees_location on public.activity_attendees;
create trigger trg_activity_attendees_location
  before insert on public.activity_attendees
  for each row execute function private.set_attendee_location();

-- Apuntarse: en tu nombre, y sólo a un evento publicado que todavía no terminó. Un evento
-- de la semana pasada no se llena de apuntados a destiempo.
drop policy if exists activity_attendees_insert on public.activity_attendees;
create policy activity_attendees_insert on public.activity_attendees
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.activities a
      join public.locations l on l.id = a.location_id
      where a.id = activity_id
        and a.status = 'scheduled'
        and l.active
        and coalesce(a.ends_at, a.starts_at + interval '12 hours') > now()
    )
  );

-- Leer: lo tuyo, y la organización (o el equipo) de ese punto.
drop policy if exists activity_attendees_read on public.activity_attendees;
create policy activity_attendees_read on public.activity_attendees
  for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_location(location_id));

-- Borrarse: sólo uno mismo. La organización no echa a nadie de la lista.
drop policy if exists activity_attendees_delete on public.activity_attendees;
create policy activity_attendees_delete on public.activity_attendees
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── 2. Cuántos van ─────────────────────────────────────────────────────────

alter table public.activities
  add column if not exists going_count integer not null default 0;

-- `security definer` porque quien se apunta no puede escribir en `activities` —y no debe—.
create or replace function private.count_attendees()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity uuid := coalesce(new.activity_id, old.activity_id);
begin
  update public.activities
     set going_count = (select count(*) from public.activity_attendees where activity_id = v_activity)
   where id = v_activity;
  return null;
end;
$$;

drop trigger if exists trg_activity_attendees_count on public.activity_attendees;
create trigger trg_activity_attendees_count
  after insert or delete on public.activity_attendees
  for each row execute function private.count_attendees();

-- ── 3. El nombre de quien se apuntó, para la organización ──────────────────

drop policy if exists profiles_attendee_read on public.profiles;
create policy profiles_attendee_read on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.activity_attendees x
      where x.user_id = profiles.user_id
        and private.can_manage_location(x.location_id)
    )
  );

-- ── 4. La imagen de una campaña ────────────────────────────────────────────

alter table public.campaigns
  add column if not exists image_url text;

notify pgrst, 'reload schema';
