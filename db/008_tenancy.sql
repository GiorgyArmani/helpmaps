-- HelpMaps · alcance por emergencia (8 de 8) — corre esto DESPUÉS de 007_emergencies.sql.
--
-- Idempotente.
--
-- ---------------------------------------------------------------------------
-- Qué hace este archivo
--
-- Cuelga las tablas existentes de una emergencia y define quién puede escribir en cuál.
-- Es aditivo: no renombra ni borra ninguna columna, y todas las columnas nuevas admiten
-- NULL con un significado explícito (ver más abajo).
--
-- ---------------------------------------------------------------------------
-- La regla que sostiene todo: NULL significa "el despliegue de un solo país"
--
-- Una fila con `emergency_id` nulo pertenece a la emergencia implícita del despliegue,
-- que es la única situación posible hoy en cualquier instalación existente. Las
-- políticas tratan ese caso como el de siempre, así que una base ya en producción sigue
-- funcionando igual sin backfill y sin ventana de mantenimiento.
--
-- Cuando se adopta el modelo multi-emergencia se crea la fila en `emergencies` y se
-- rellenan las existentes de una vez (hay un ejemplo comentado al final del archivo).
--
-- ---------------------------------------------------------------------------
-- Por qué el alcance vive en RLS y no en la aplicación
--
-- La alternativa era llevar el identificador de la emergencia en cada consulta de la
-- app. Con el modelo de confianza de este proyecto —voluntarios verificados que
-- publican EN VIVO, sin cola de revisión delante— un filtro que alguien olvida no es una
-- fila mal contada: es un voluntario de un país editando los puntos de otro. En la base
-- no se puede olvidar.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- 1) Roles
-- ===========================================================================

-- `superadmin` se suma a los dos roles existentes. Administra la RED: da de alta
-- emergencias y nombra a quienes las administran. No reemplaza a `admin`, que sigue
-- siendo quien manda dentro de una emergencia concreta.
alter table public.staff_users drop constraint if exists staff_users_role_check;
alter table public.staff_users add constraint staff_users_role_check
  check (role in ('superadmin','admin','volunteer'));

-- Membresía: en qué emergencias trabaja cada persona.
--
-- Deliberadamente SIN columna de rol. El rol dice qué puede hacer alguien y vive en
-- `staff_users`; la membresía dice dónde puede hacerlo y vive aquí. Guardar el rol dos
-- veces es garantizar que algún día digan cosas distintas.
create table if not exists public.staff_emergencies (
  user_id      uuid not null references auth.users(id) on delete cascade,
  emergency_id uuid not null references public.emergencies(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, emergency_id)
);

create index if not exists staff_emergencies_emergency_idx
  on public.staff_emergencies (emergency_id);

alter table public.staff_emergencies enable row level security;


-- ===========================================================================
-- 2) Funciones de alcance
--
-- `security definer` por la misma razón que `is_staff()`: se llaman DESDE las políticas,
-- así que no pueden depender de que quien consulta pueda leer estas tablas.
-- ===========================================================================

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_users
    where user_id = auth.uid() and role = 'superadmin'
  );
$$;

-- `is_admin()` se redefine para que un superadmin también cuente como admin. Todas las
-- políticas que ya existen y dicen `is_admin()` siguen escritas igual y ahora incluyen
-- al rol de arriba, que es lo que se espera de un rol de arriba. Para una instalación
-- sin superadmins el comportamiento es idéntico al anterior.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_users
    where user_id = auth.uid() and role in ('admin','superadmin')
  );
$$;

-- ¿Esta persona alcanza esta emergencia?
--
-- El `eid is null` de la primera línea es la compatibilidad hacia atrás en una
-- expresión: en una base que todavía no adoptó el modelo, todas las filas tienen null y
-- esta función devuelve lo mismo que antes de existir.
create or replace function public.belongs_to(eid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select eid is null
      or public.is_superadmin()
      or exists (
        select 1 from public.staff_emergencies
        where user_id = auth.uid() and emergency_id = eid
      );
$$;

-- Escribir: ser staff Y alcanzar esa emergencia.
create or replace function public.can_edit(eid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_staff() and public.belongs_to(eid);
$$;

-- Borrar: sigue siendo solo de admin, ahora además acotado. Borrar un centro arrastra su
-- información y un pin equivocado manda gente al lugar equivocado.
create or replace function public.can_delete(eid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin() and public.belongs_to(eid);
$$;


-- ===========================================================================
-- 3) Columnas de alcance
-- ===========================================================================

alter table public.locations
  add column if not exists emergency_id uuid references public.emergencies(id) on delete restrict;

alter table public.submissions
  add column if not exists emergency_id uuid references public.emergencies(id) on delete cascade;

alter table public.volunteer_requests
  add column if not exists emergency_id uuid references public.emergencies(id) on delete cascade;

alter table public.donations
  add column if not exists emergency_id uuid references public.emergencies(id) on delete cascade;

alter table public.audit_log
  add column if not exists emergency_id uuid;

create index if not exists locations_emergency_idx on public.locations (emergency_id);
create index if not exists submissions_emergency_idx on public.submissions (emergency_id);
create index if not exists donations_emergency_idx on public.donations (emergency_id);
create index if not exists audit_log_emergency_idx on public.audit_log (emergency_id);

-- `on delete restrict` en locations es a propósito: borrar una emergencia no puede
-- llevarse por delante los puntos publicados. Se archiva, no se borra.


-- ===========================================================================
-- 4) La diáspora
--
-- AcopioVE opera 712 puntos en 24 países: la red que recoge ayuda en Bilbao, Lisboa,
-- Tulsa o Guadalajara lo hace PARA la emergencia venezolana. En un modelo donde la
-- emergencia tiene límites geográficos, esos puntos caen fuera del encuadre y no tienen
-- código de región válido — y desaparecerían en la importación.
--
-- NULL significa "en el país de la emergencia", que es el caso normal. Un valor
-- distinto al del evento marca un punto de la diáspora: se muestra como capa aparte y se
-- cuenta aparte, porque no es un lugar al que mandar a alguien que está en la zona.
-- ===========================================================================

alter table public.locations
  add column if not exists country_code text;

create index if not exists locations_country_idx on public.locations (country_code)
  where country_code is not null;


-- ===========================================================================
-- 5) Teléfonos de emergencia
--
-- AcopioVE mantiene 78 y hoy no tienen dónde ir en este esquema.
--
-- Tabla aparte y NO un tipo de punto, por el mismo argumento con el que `donations`
-- quedó fuera de `locations`: no es un lugar al que nadie deba viajar, y ponerlo en el
-- mapa manda a alguien a una puerta cuando lo que necesitaba era marcar un número.
-- ===========================================================================

create table if not exists public.emergency_phones (
  id            uuid primary key default gen_random_uuid(),
  emergency_id  uuid references public.emergencies(id) on delete cascade,
  name          text not null,
  number        text not null,
  description   text,
  -- Ámbito geográfico del número: nacional si ambos son nulos.
  region        text,
  municipality  text,
  sort          integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists emergency_phones_emergency_idx
  on public.emergency_phones (emergency_id) where active;

drop trigger if exists trg_emergency_phones_touch on public.emergency_phones;
create trigger trg_emergency_phones_touch before update on public.emergency_phones
  for each row execute function public.touch_updated_at();

alter table public.emergency_phones enable row level security;

drop policy if exists emergency_phones_public_read on public.emergency_phones;
create policy emergency_phones_public_read on public.emergency_phones
  for select to anon, authenticated using (active);

drop policy if exists emergency_phones_staff_write on public.emergency_phones;
create policy emergency_phones_staff_write on public.emergency_phones
  for all to authenticated
  using (public.can_edit(emergency_id))
  with check (public.can_edit(emergency_id));


-- ===========================================================================
-- 6) Políticas acotadas
--
-- Se reescriben las de escritura para que además comprueben el alcance. Las de lectura
-- pública NO se tocan: el mapa existe para que cualquiera lea los puntos, y eso no
-- cambia porque ahora haya más de una emergencia en la misma base.
-- ===========================================================================

-- locations
drop policy if exists locations_staff_insert on public.locations;
create policy locations_staff_insert on public.locations
  for insert to authenticated with check (public.can_edit(emergency_id));

drop policy if exists locations_staff_update on public.locations;
create policy locations_staff_update on public.locations
  for update to authenticated
  using (public.can_edit(emergency_id))
  with check (public.can_edit(emergency_id));

drop policy if exists locations_admin_delete on public.locations;
create policy locations_admin_delete on public.locations
  for delete to authenticated using (public.can_delete(emergency_id));

-- center_info — cuelga de locations, así que su alcance es el de su punto.
drop policy if exists center_info_staff_insert on public.center_info;
create policy center_info_staff_insert on public.center_info
  for insert to authenticated with check (
    public.can_edit((select l.emergency_id from public.locations l where l.id = location_id))
  );

drop policy if exists center_info_staff_update on public.center_info;
create policy center_info_staff_update on public.center_info
  for update to authenticated using (
    public.can_edit((select l.emergency_id from public.locations l where l.id = location_id))
  ) with check (
    public.can_edit((select l.emergency_id from public.locations l where l.id = location_id))
  );

drop policy if exists center_info_admin_delete on public.center_info;
create policy center_info_admin_delete on public.center_info
  for delete to authenticated using (
    public.can_delete((select l.emergency_id from public.locations l where l.id = location_id))
  );

-- submissions — el insert público sigue abierto y sin leer nunca de vuelta.
drop policy if exists submissions_staff_read on public.submissions;
create policy submissions_staff_read on public.submissions
  for select to authenticated using (public.can_edit(emergency_id));

drop policy if exists submissions_staff_update on public.submissions;
create policy submissions_staff_update on public.submissions
  for update to authenticated
  using (public.can_edit(emergency_id))
  with check (public.can_edit(emergency_id));

drop policy if exists submissions_admin_delete on public.submissions;
create policy submissions_admin_delete on public.submissions
  for delete to authenticated using (public.can_delete(emergency_id));

-- volunteer_requests — solo admin, ahora además acotado.
drop policy if exists volunteer_requests_admin_read on public.volunteer_requests;
create policy volunteer_requests_admin_read on public.volunteer_requests
  for select to authenticated using (public.can_delete(emergency_id));

drop policy if exists volunteer_requests_admin_update on public.volunteer_requests;
create policy volunteer_requests_admin_update on public.volunteer_requests
  for update to authenticated
  using (public.can_delete(emergency_id))
  with check (public.can_delete(emergency_id));

drop policy if exists volunteer_requests_admin_delete on public.volunteer_requests;
create policy volunteer_requests_admin_delete on public.volunteer_requests
  for delete to authenticated using (public.can_delete(emergency_id));

-- donations
drop policy if exists donations_staff_insert on public.donations;
create policy donations_staff_insert on public.donations
  for insert to authenticated with check (public.can_edit(emergency_id));

drop policy if exists donations_staff_update on public.donations;
create policy donations_staff_update on public.donations
  for update to authenticated
  using (public.can_edit(emergency_id))
  with check (public.can_edit(emergency_id));

drop policy if exists donations_admin_delete on public.donations;
create policy donations_admin_delete on public.donations
  for delete to authenticated using (public.can_delete(emergency_id));

-- audit_log — sigue siendo append-only y sin política de escritura para nadie.
--
-- Esta política CONSERVA la regla que introdujo 006_audit_scope.sql (un voluntario solo
-- ve lo que cambió en el mapa, nunca las solicitudes de voluntariado de otras personas)
-- y le suma el alcance por emergencia. Las dos condiciones se cruzan con AND: primero
-- hay que alcanzar la emergencia, y después seguir cumpliendo la regla por entidad.
--
-- Escribirla solo con el alcance habría devuelto a los voluntarios la lectura de
-- `volunteer_requests` dentro de su propia emergencia, que es exactamente lo que 006
-- vino a cerrar.
drop policy if exists audit_log_staff_read on public.audit_log;
create policy audit_log_staff_read on public.audit_log
  for select to authenticated
  using (
    public.belongs_to(emergency_id)
    and (
      public.is_admin()
      or (public.is_staff() and public.audit_entity_visible_to_staff(entity))
    )
  );

-- staff_emergencies — cada quien ve sus membresías; solo un superadmin las cambia.
drop policy if exists staff_emergencies_self_read on public.staff_emergencies;
create policy staff_emergencies_self_read on public.staff_emergencies
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_superadmin());

drop policy if exists staff_emergencies_super_write on public.staff_emergencies;
create policy staff_emergencies_super_write on public.staff_emergencies
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- emergencies — la escritura que 007 dejó pendiente a propósito.
drop policy if exists emergencies_super_write on public.emergencies;
create policy emergencies_super_write on public.emergencies
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Un admin puede cambiar el aviso y el modo mantenimiento de SU emergencia, igual que
-- hoy lo hace sobre `app_settings`. No puede cambiar nada más de la fila: el encuadre,
-- las regiones y el marco legal son de la red.
drop policy if exists emergencies_admin_notice on public.emergencies;
create policy emergencies_admin_notice on public.emergencies
  for update to authenticated
  using (public.is_admin() and public.belongs_to(id))
  with check (public.is_admin() and public.belongs_to(id));


-- ===========================================================================
-- 7) La bitácora registra a qué emergencia pertenece cada cambio
--
-- Misma función de 004, con dos líneas más. Se mantiene `security definer`, el corte de
-- los UPDATE que no cambian nada, y el `exception when others` que garantiza que fallar
-- al registrar nunca tumbe la escritura real.
-- ===========================================================================

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action  text;
  v_entity  text := tg_table_name;
  v_id      text;
  v_summary text;
  v_email   text;
  v_role    text;
  v_emerg   uuid;
  v_row     jsonb;
begin
  if tg_op = 'UPDATE'
     and to_jsonb(new) - 'updated_at' - 'created_at'
         is not distinct from to_jsonb(old) - 'updated_at' - 'created_at' then
    return null;
  end if;

  v_row := to_jsonb(coalesce(new, old));
  v_action := lower(tg_table_name) || '_' || lower(tg_op);

  select su.role, su.email into v_role, v_email
  from public.staff_users su where su.user_id = auth.uid();

  if tg_op = 'DELETE' then
    v_id := coalesce(old.id::text, null);
  else
    v_id := coalesce(new.id::text, null);
  end if;

  if tg_table_name = 'locations' then
    v_summary := coalesce(v_row ->> 'name', '');
  elsif tg_table_name = 'center_info' then
    v_id := coalesce(v_row ->> 'location_id', v_id);
    v_summary := left(coalesce(v_row ->> 'needs', ''), 120);
  elsif tg_table_name = 'submissions' then
    v_summary := left(coalesce(v_row ->> 'message', ''), 120);
  elsif tg_table_name = 'volunteer_requests' then
    v_summary := coalesce(v_row ->> 'name', '');
  elsif tg_table_name = 'donations' then
    v_summary := coalesce(v_row ->> 'name', '');
  end if;

  -- La emergencia sale de la propia fila; `center_info` la hereda de su punto.
  if tg_table_name = 'center_info' then
    select l.emergency_id into v_emerg
    from public.locations l where l.id = (v_row ->> 'location_id');
  else
    v_emerg := nullif(v_row ->> 'emergency_id', '')::uuid;
  end if;

  insert into public.audit_log
    (action, entity, entity_id, summary, actor_id, actor_email, actor_role, emergency_id)
  values
    (v_action, v_entity, v_id, v_summary, auth.uid(), v_email, v_role, v_emerg);

  return null;
exception when others then
  return null;
end;
$$;

drop trigger if exists trg_audit_donations on public.donations;
create trigger trg_audit_donations after insert or update or delete on public.donations
  for each row execute function public.audit_row();


-- ===========================================================================
-- 8) Adoptar el modelo en una base que ya está en producción
--
-- No hace falta para que esta migración sea segura: sin hacer nada, todas las filas
-- quedan con `emergency_id` nulo y el despliegue sigue comportándose como antes.
--
-- Cuando se quiera adoptar, es esto (con el id real de la fila creada en `emergencies`):
--
--   update public.locations          set emergency_id = '<uuid>' where emergency_id is null;
--   update public.submissions        set emergency_id = '<uuid>' where emergency_id is null;
--   update public.volunteer_requests set emergency_id = '<uuid>' where emergency_id is null;
--   update public.donations          set emergency_id = '<uuid>' where emergency_id is null;
--
-- Y después, para que no vuelvan a entrar filas huérfanas:
--
--   alter table public.locations alter column emergency_id set not null;
--
-- Corré `db/099_security_check.sql` al terminar.
-- ===========================================================================
