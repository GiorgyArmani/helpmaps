-- HelpMaps · aportes del público (3 de 4) — corre esto DESPUÉS de 002_staff.sql.
--
-- Dos colas, el mismo principio: cualquiera puede INSERTAR una fila 'pending' y NADIE
-- del público puede leerlas de vuelta. Quien sugiere un punto o pide sumarse deja su
-- contacto ahí; que otro visitante pudiera listarlo convertiría el formulario en un
-- directorio de teléfonos de gente que está ayudando.
--
-- Idempotente.

-- --------------------------------------------------------------------------
-- submissions — "registra tu iniciativa" / "falta este punto en el mapa".
-- No escribe el mapa: es una sugerencia que un humano revisa y publica a mano.
-- --------------------------------------------------------------------------
create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'center'
                check (kind in ('center','initiative','need','other')),
  message     text not null,
  name        text,
  contact     text,
  payload     jsonb,
  status      text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists submissions_pending_idx
  on public.submissions (created_at desc) where status = 'pending';

alter table public.submissions enable row level security;

-- El público solo puede CREAR, y solo en estado 'pending'.
-- `to anon, authenticated` a propósito: un voluntario con sesión abierta que usa el
-- formulario público es `authenticated`, no `anon`, y sin esto le fallaría el envío.
drop policy if exists submissions_public_insert on public.submissions;
create policy submissions_public_insert on public.submissions
  for insert to anon, authenticated with check (status = 'pending');

drop policy if exists submissions_staff_read on public.submissions;
create policy submissions_staff_read on public.submissions
  for select to authenticated using (public.is_staff());

drop policy if exists submissions_staff_update on public.submissions;
create policy submissions_staff_update on public.submissions
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists submissions_admin_delete on public.submissions;
create policy submissions_admin_delete on public.submissions
  for delete to authenticated using (public.is_admin());

-- Blindaje: ni un INSERT público con `status` manipulado ni un UPDATE que resucite
-- una fila ya revisada. La política de arriba cubre el INSERT; esto cubre el resto.
create or replace function public.guard_submission_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status is distinct from 'pending' then
    new.status := 'pending';
  end if;
  if tg_op = 'UPDATE' then
    if not public.is_staff() then
      raise exception 'only staff may review submissions';
    end if;
    new.reviewed_at := now();
    new.reviewed_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_submissions_guard on public.submissions;
create trigger trg_submissions_guard before insert or update on public.submissions
  for each row execute function public.guard_submission_status();

-- --------------------------------------------------------------------------
-- volunteer_requests — "quiero sumarme al equipo".
--
-- Da acceso a publicar en vivo sobre el mapa, así que lo aprueba un admin a mano.
-- Igual que arriba: insertar sí, leer no.
-- --------------------------------------------------------------------------
create table if not exists public.volunteer_requests (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text,
  profile     text,
  motivation  text,
  region      text,
  status      text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists volunteer_requests_pending_idx
  on public.volunteer_requests (created_at desc) where status = 'pending';

alter table public.volunteer_requests enable row level security;

drop policy if exists volunteer_requests_public_insert on public.volunteer_requests;
create policy volunteer_requests_public_insert on public.volunteer_requests
  for insert to anon, authenticated with check (status = 'pending');

drop policy if exists volunteer_requests_admin_read on public.volunteer_requests;
create policy volunteer_requests_admin_read on public.volunteer_requests
  for select to authenticated using (public.is_admin());

drop policy if exists volunteer_requests_admin_update on public.volunteer_requests;
create policy volunteer_requests_admin_update on public.volunteer_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists volunteer_requests_admin_delete on public.volunteer_requests;
create policy volunteer_requests_admin_delete on public.volunteer_requests
  for delete to authenticated using (public.is_admin());

create or replace function public.guard_volunteer_request_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status is distinct from 'pending' then
    new.status := 'pending';
  end if;
  if tg_op = 'UPDATE' then
    if not public.is_admin() then
      raise exception 'only admins may review volunteer requests';
    end if;
    new.reviewed_at := now();
    new.reviewed_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_volunteer_requests_guard on public.volunteer_requests;
create trigger trg_volunteer_requests_guard before insert or update on public.volunteer_requests
  for each row execute function public.guard_volunteer_request_status();
