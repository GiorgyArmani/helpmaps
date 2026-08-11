-- HelpMaps · bitácora (4 de 4) — corre esto DESPUÉS de 003_submissions.sql.
--
-- El audit log vive en la BASE, no en la app, y por una razón concreta: los voluntarios
-- publican en vivo con la anon key desde el navegador. Si el registro dependiera del
-- código cliente, cualquier ruta que olvide llamarlo (o cualquiera que hable con
-- PostgREST directamente) quedaría sin rastro. Un trigger no se puede saltar.
--
-- Append-only: NO hay política de insert/update/delete para nadie. La única forma de
-- escribir aquí es el trigger `security definer`.
--
-- Idempotente.

create table if not exists public.audit_log (
  id          bigserial primary key,
  action      text not null,
  entity      text not null,
  entity_id   text,
  summary     text,
  actor_id    uuid,
  actor_email text,
  actor_role  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_staff_read on public.audit_log;
create policy audit_log_staff_read on public.audit_log
  for select to authenticated using (public.is_staff());

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
begin
  -- Un pipeline que reescribe todo cada pocos minutos genera un UPDATE por fila aunque
  -- nada haya cambiado. Sin esta guarda la bitácora crece decenas de miles de filas al
  -- día y entierra la actividad real (pasó en producción, junio 2026).
  if tg_op = 'UPDATE'
     and to_jsonb(new) - 'updated_at' - 'created_at'
         is not distinct from to_jsonb(old) - 'updated_at' - 'created_at' then
    return null;
  end if;

  v_action := lower(tg_table_name) || '_' || lower(tg_op);

  select su.role, su.email into v_role, v_email
  from public.staff_users su where su.user_id = auth.uid();

  if tg_op = 'DELETE' then
    v_id := coalesce(old.id::text, null);
  else
    v_id := coalesce(new.id::text, null);
  end if;

  -- Resumen legible por tabla. `to_jsonb` evita depender de columnas que no existen.
  if tg_table_name = 'locations' then
    v_summary := coalesce((to_jsonb(coalesce(new, old)) ->> 'name'), '');
  elsif tg_table_name = 'center_info' then
    v_id := coalesce(to_jsonb(coalesce(new, old)) ->> 'location_id', v_id);
    v_summary := left(coalesce(to_jsonb(coalesce(new, old)) ->> 'needs', ''), 120);
  elsif tg_table_name = 'submissions' then
    v_summary := left(coalesce(to_jsonb(coalesce(new, old)) ->> 'message', ''), 120);
  elsif tg_table_name = 'volunteer_requests' then
    v_summary := coalesce(to_jsonb(coalesce(new, old)) ->> 'name', '');
  elsif tg_table_name = 'donations' then
    v_summary := coalesce(to_jsonb(coalesce(new, old)) ->> 'name', '');
  end if;

  insert into public.audit_log (action, entity, entity_id, summary, actor_id, actor_email, actor_role)
  values (v_action, v_entity, v_id, v_summary, auth.uid(), v_email, v_role);

  return null;
exception when others then
  -- SEGURIDAD: registrar nunca puede tumbar la escritura real. Que se pierda una línea
  -- de bitácora es aceptable; que falle el alta de un refugio, no.
  return null;
end;
$$;

drop trigger if exists trg_audit_locations on public.locations;
create trigger trg_audit_locations after insert or update or delete on public.locations
  for each row execute function public.audit_row();

drop trigger if exists trg_audit_center_info on public.center_info;
create trigger trg_audit_center_info after insert or update or delete on public.center_info
  for each row execute function public.audit_row();

drop trigger if exists trg_audit_submissions on public.submissions;
create trigger trg_audit_submissions after insert or update on public.submissions
  for each row execute function public.audit_row();

drop trigger if exists trg_audit_volunteer_requests on public.volunteer_requests;
create trigger trg_audit_volunteer_requests after insert or update on public.volunteer_requests
  for each row execute function public.audit_row();
