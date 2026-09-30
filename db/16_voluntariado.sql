-- ===========================================================================
-- db/16_voluntariado.sql — lo que sabes hacer, lo que le falta a un evento, y quién vino
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `020_voluntariado` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro. Corre después de db/13_eventos.sql.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Añade columnas y una función; las políticas
-- que toca son de `activity_attendees`, así que no bloquea las lecturas del mapa.
--
-- QUÉ AÑADE
--
--   1. `profiles.skills` y `profiles.availability`: el perfil de voluntario. Qué oficios
--      tiene y cuándo puede. Los ve la persona y, como ya pasaba con su nombre, la
--      organización de un evento al que se apuntó (`profiles_attendee_read`): es justo lo
--      que esa organización necesita saber para repartir tareas. Nadie más.
--
--   2. `activities.needs` y `activities.skills`: qué le FALTA a un evento —manos, oficios,
--      donación en especie o difusión— y, si son oficios, cuáles. `needs_volunteers` se
--      queda y la app lo escribe igual, derivado de `needs`, para que nada que lo lea hoy
--      se rompa.
--
--   3. La asistencia comprobada. `activity_attendees.attended_at` lo marca la organización
--      después del evento, con `confirm_attendance()`, y un trigger otorga la experiencia
--      de `volunteer`. Es la pieza que faltaba: `volunteer` valía puntos y nada los daba.
--
-- LA REGLA DE SIEMPRE: la experiencia sólo se gana por lo COMPROBADO. Apuntarse es
-- declarado y no suma; que la organización diga «vino» es la comprobación. Y nadie se
-- confirma a sí mismo: un gestor que se apunta a su propio evento no se da puntos.
--
-- MIENTRAS NO SE CORRA la app funciona igual: sin oficios en la cuenta, sin «qué falta»
-- en los eventos y sin bandeja de asistencia.
-- ===========================================================================

-- ── 1. El perfil de voluntario ─────────────────────────────────────────────

-- El catálogo vive en la app (`src/domain/volunteer.ts`) y aquí sólo se acota el tamaño:
-- añadir un oficio no debería pedir una migración, y un valor que la app no conoce
-- simplemente no se pinta.
alter table public.profiles
  add column if not exists skills text[] not null default '{}',
  add column if not exists availability text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_skills_size;
alter table public.profiles add constraint profiles_skills_size
  check (cardinality(skills) <= 16 and cardinality(availability) <= 8);

-- ── 2. Lo que le falta a un evento ─────────────────────────────────────────

alter table public.activities
  add column if not exists needs text[] not null default '{}',
  add column if not exists skills text[] not null default '{}';

-- `needs` es un conjunto cerrado —son las cuatro formas de ayudar que la plataforma sabe
-- enseñar—, así que ése sí se valida entero.
alter table public.activities drop constraint if exists activities_needs_known;
alter table public.activities add constraint activities_needs_known
  check (
    needs <@ array['hands', 'skills', 'in_kind', 'spread']::text[]
    and cardinality(skills) <= 16
  );

-- Los eventos de antes: «necesita voluntarios» era pedir manos.
update public.activities
   set needs = array['hands']
 where needs_volunteers and cardinality(needs) = 0;

-- ── 3. Quién vino ──────────────────────────────────────────────────────────

alter table public.activity_attendees
  add column if not exists attended_at timestamptz,
  add column if not exists attended_by uuid references auth.users(id) on delete set null;

-- Sin política de UPDATE a propósito: la única forma de marcar una asistencia es la
-- función de abajo, que comprueba quién la marca, sobre qué evento y cuándo.

-- Borrarse: sólo uno mismo, y sólo mientras no esté confirmado. Una asistencia comprobada
-- ya es historia de la organización; la experiencia que dio no se devuelve, y la fila
-- que la justifica tampoco debería desaparecer.
drop policy if exists activity_attendees_delete on public.activity_attendees;
create policy activity_attendees_delete on public.activity_attendees
  for delete to authenticated
  using (user_id = (select auth.uid()) and attended_at is null);

/**
 * La organización dice quién vino. Devuelve cuántas asistencias quedaron marcadas.
 *
 * Sólo quien gestiona el punto, sólo sobre un evento que ya empezó y que no terminó hace
 * más de 30 días (confirmar al día siguiente es lo normal; confirmar en diciembre lo de
 * marzo ya no se puede comprobar), y nunca a uno mismo. Lo ya confirmado no se toca.
 */
create or replace function public.confirm_attendance(p_activity uuid, p_users uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $conf$
declare
  v_me    uuid := auth.uid();
  v_loc   text;
  v_start timestamptz;
  v_end   timestamptz;
  v_n     int;
begin
  if v_me is null then
    raise exception 'Hace falta una sesión.';
  end if;

  select a.location_id, a.starts_at, coalesce(a.ends_at, a.starts_at + interval '12 hours')
    into v_loc, v_start, v_end
    from public.activities a
   where a.id = p_activity;

  if v_loc is null or not private.can_manage_location(v_loc) then
    raise exception 'Ese evento no es tuyo.' using errcode = '42501';
  end if;
  if v_start > now() then
    raise exception 'El evento todavía no empezó.';
  end if;
  if v_end < now() - interval '30 days' then
    raise exception 'Ese evento terminó hace más de 30 días.';
  end if;

  update public.activity_attendees
     set attended_at = now(),
         attended_by = v_me
   where activity_id = p_activity
     and user_id = any(p_users)
     and user_id <> v_me
     and attended_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end
$conf$;

revoke all on function public.confirm_attendance(uuid, uuid[]) from public, anon;
grant execute on function public.confirm_attendance(uuid, uuid[]) to authenticated;

-- La experiencia, cuando la organización confirma. Mismo patrón que
-- `reward_confirmed_donation`: cuelga del hecho y no de la pantalla, y el valor sale de
-- `contribution_points`. El índice de una-vez-al-día sigue mandando: dos eventos del mismo
-- punto el mismo día suman una vez.
create or replace function public.reward_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $reward$
begin
  if new.attended_at is not null and old.attended_at is null then
    insert into public.contributions (user_id, kind, location_id, points, emergency_id)
    values (
      new.user_id, 'volunteer', new.location_id,
      public.contribution_points('volunteer'),
      (select emergency_id from public.locations where id = new.location_id)
    )
    on conflict do nothing;
  end if;
  return new;
end
$reward$;

drop trigger if exists trg_activity_attendees_reward on public.activity_attendees;
create trigger trg_activity_attendees_reward
  after update of attended_at on public.activity_attendees
  for each row execute function public.reward_attendance();

notify pgrst, 'reload schema';
