-- ===========================================================================
-- HelpMaps · «¿ES TU ORGANIZACIÓN?». Corre esto después de 05_iniciativas.sql.
-- ===========================================================================
--
-- Hasta aquí una organización sólo podía entrar si el equipo la invitaba
-- (`center_invites`). Eso sirve cuando el equipo ya conoce a la persona, y no sirve para
-- lo que viene: una campaña que le dice a cientos de ONG y fundaciones «tu organización
-- ya está en el mapa, toma el control de su perfil». Quien recibe ese mensaje llega a su
-- ficha y necesita una puerta ahí mismo.
--
-- ---------------------------------------------------------------------------
-- EL FLUJO
--
--   la persona entra con su cuenta → pide gestionar el punto → el equipo lo comprueba
--   → aprueba → la base la deja en `center_managers` → al abrir el mapa cae en el
--   onboarding, igual que quien llegó por invitación.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ LO APRUEBA UNA PERSONA Y NO SE CONCEDE SOLO
--
-- Gestionar un punto es publicar en vivo a nombre de una organización: su estado, lo que
-- necesita y, sobre todo, sus DATOS DE COBRO. Si bastara con pedirlo, cualquiera podría
-- quedarse con la ficha de un comedor conocido y cambiar el pago móvil por el suyo. Por
-- eso la solicitud pide lo que el equipo necesita para comprobarla —el cargo, un teléfono
-- y cómo verificarlo— y nada se concede hasta que alguien del equipo de esa emergencia
-- dice que sí.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ EXIGE CUENTA
--
-- La invitación sin correo existe porque el equipo YA habló con la persona. Aquí no:
-- quien pide es un desconocido hasta que se comprueba, y la aprobación tiene que caer
-- sobre una cuenta concreta. Además evita un segundo paso: aprobar ya deja a la persona
-- dentro, sin enlace que canjear ni que se pierda.
-- ===========================================================================

create table if not exists public.manage_requests (
  id          uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- Lo que el equipo necesita para comprobar que es quien dice ser.
  role        text not null check (char_length(role) between 2 and 120),
  phone       text check (phone is null or char_length(phone) <= 40),
  proof       text check (proof is null or char_length(proof) <= 600),

  status      text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

-- Una solicitud viva por persona y punto. Rechazada sí deja volver a pedir: el motivo
-- más común de un rechazo es «no pudimos comprobarlo», y eso se arregla dando otro dato.
create unique index if not exists manage_requests_one_pending
  on public.manage_requests (user_id, location_id) where status = 'pending';

create index if not exists manage_requests_pending_idx
  on public.manage_requests (created_at desc) where status = 'pending';

alter table public.manage_requests enable row level security;

-- Pedir: con sesión, a nombre propio, y sólo si todavía no gestionas ese punto.
drop policy if exists manage_requests_insert on public.manage_requests;
create policy manage_requests_insert on public.manage_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and not private.manages_location(location_id)
  );

-- Leer: lo propio —para que la ficha diga «la estamos revisando»— y el equipo que alcanza
-- la emergencia de ese punto. El teléfono y el cargo no son públicos.
drop policy if exists manage_requests_read on public.manage_requests;
create policy manage_requests_read on public.manage_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_edit((select emergency_id from public.locations where id = location_id))
  );

-- Resolver: sólo ese mismo equipo.
drop policy if exists manage_requests_staff_update on public.manage_requests;
create policy manage_requests_staff_update on public.manage_requests
  for update to authenticated
  using (private.can_edit((select emergency_id from public.locations where id = location_id)))
  with check (private.can_edit((select emergency_id from public.locations where id = location_id)));

drop policy if exists manage_requests_staff_delete on public.manage_requests;
create policy manage_requests_staff_delete on public.manage_requests
  for delete to authenticated
  using (private.can_edit((select emergency_id from public.locations where id = location_id)));

-- La guarda. Al crear, nada puede llegar ya resuelto. Al resolver, sólo cambia el
-- estado, una sola vez, y queda firmado: quién y cuándo.
create or replace function public.guard_manage_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.status      := 'pending';
    new.reviewed_at := null;
    new.reviewed_by := null;
    return new;
  end if;

  if old.status <> 'pending' then
    raise exception 'Esa solicitud ya se resolvió.';
  end if;

  -- Lo que pidió la persona no se reescribe al resolver.
  new.location_id := old.location_id;
  new.user_id     := old.user_id;
  new.role        := old.role;
  new.phone       := old.phone;
  new.proof       := old.proof;
  new.created_at  := old.created_at;
  new.reviewed_at := now();
  new.reviewed_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_manage_requests_guard on public.manage_requests;
create trigger trg_manage_requests_guard before insert or update on public.manage_requests
  for each row execute function public.guard_manage_request();

-- Aprobar ES dar las llaves. Va en un trigger, y no en la pantalla, para que una
-- solicitud no pueda quedar «aprobada» sin gestor detrás si alguien la resuelve desde
-- otro sitio. Corre con los permisos de quien aprueba (no es definer), así que el
-- insert pasa por `center_managers_staff_insert`: RLS lo comprueba dos veces.
create or replace function public.grant_manage_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.center_managers (user_id, location_id, invited_by)
    values (new.user_id, new.location_id, auth.uid())
    on conflict (user_id, location_id) do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_manage_requests_grant on public.manage_requests;
create trigger trg_manage_requests_grant after update on public.manage_requests
  for each row execute function public.grant_manage_request();

-- Bitácora: repartir las llaves de un punto es lo que hay que poder mirar después.
drop trigger if exists trg_manage_requests_audit on public.manage_requests;
create trigger trg_manage_requests_audit after insert or update on public.manage_requests
  for each row execute function public.audit_row();
