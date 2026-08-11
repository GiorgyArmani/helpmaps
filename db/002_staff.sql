-- HelpMaps · roles y escritura (2 de 4) — corre esto DESPUÉS de 001_core.sql.
--
-- Modelo de confianza (heredado de la operación real en Venezuela):
--   • Los voluntarios son gente verificada y publican EN VIVO, sin cola de revisión.
--     Esperar una autorización cuesta horas que en una emergencia no existen.
--   • Lo que los frena no es una revisión previa sino que el acceso es REVOCABLE al
--     instante y todo queda en el audit log.
--   • BORRAR sigue siendo solo de admin: borrar un centro arrastra su información y un
--     pin equivocado manda gente al lugar equivocado.
--
-- Idempotente.

create table if not exists public.staff_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','volunteer')),
  email      text,
  created_at timestamptz not null default now()
);

alter table public.staff_users enable row level security;

-- security definer: estas funciones se llaman DESDE las políticas RLS, así que no
-- pueden depender de que quien consulta pueda leer la tabla.
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff_users where user_id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_users where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Cada quien ve su propia fila (la app la usa para saber si mostrar el panel).
-- Los admins ven todo el equipo.
drop policy if exists staff_users_self_read on public.staff_users;
create policy staff_users_self_read on public.staff_users
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists staff_users_admin_write on public.staff_users;
create policy staff_users_admin_write on public.staff_users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Escritura sobre el mapa: staff inserta y edita; solo admin borra.
-- --------------------------------------------------------------------------
drop policy if exists locations_staff_insert on public.locations;
create policy locations_staff_insert on public.locations
  for insert to authenticated with check (public.is_staff());

drop policy if exists locations_staff_update on public.locations;
create policy locations_staff_update on public.locations
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists locations_admin_delete on public.locations;
create policy locations_admin_delete on public.locations
  for delete to authenticated using (public.is_admin());

drop policy if exists center_info_staff_insert on public.center_info;
create policy center_info_staff_insert on public.center_info
  for insert to authenticated with check (public.is_staff());

drop policy if exists center_info_staff_update on public.center_info;
create policy center_info_staff_update on public.center_info
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists center_info_admin_delete on public.center_info;
create policy center_info_admin_delete on public.center_info
  for delete to authenticated using (public.is_admin());

-- El aviso de mantenimiento lo cambia solo un admin: apagar el mapa para todo el país
-- no es una acción de voluntario.
drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Primer admin: no hay forma de crearlo desde la app (haría falta ser admin para eso).
-- Crea el usuario en Authentication → Users y luego corre, con su UUID:
--
--   insert into public.staff_users (user_id, role, email)
--   values ('00000000-0000-0000-0000-000000000000', 'admin', 'tu@correo.net')
--   on conflict (user_id) do update set role = 'admin';
-- --------------------------------------------------------------------------
