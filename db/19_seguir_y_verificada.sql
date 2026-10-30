-- ===========================================================================
-- db/19_seguir_y_verificada.sql — seguir organizaciones, sello «Verificada» y métricas
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `023_seguir_y_verificada` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Son columnas nuevas, una tabla, triggers y
-- tres funciones. No recrea políticas viejas, así que no hace falta volver a correr 09/10.
--
-- QUÉ AÑADE
--
-- 1. `center_follows`: seguir a una organización. Es distinto de `favourites`: guardar un
--    punto es «lo quiero tener a mano» (un refugio cerca de casa); seguir es «quiero
--    enterarme de lo que hace». Una cosa no implica la otra. El número de seguidores es
--    público (`center_stats.followers_count`); QUIÉN sigue a quién, no: lo lee sólo su dueño.
--    El contador va en una tabla aparte y no en `center_info` a propósito: escribir ahí
--    mueve `updated_at` y deja una línea en la bitácora, y un punto que nadie confirma hace
--    dos meses no puede parecer fresco porque alguien lo siguió.
--
-- 2. El sello «Verificada» con vigencia:
--    · Se GANA cuando el equipo aprueba a un gestor: aprobar a alguien para que hable en
--      nombre de un punto ya es verificar la organización (se comprobó quién es).
--    · CADUCA a los 90 días sin re-verificar. La app lo calcula sobre `verified_at`; aquí no
--      hay un cron que lo apague, y no hace falta: una fecha vieja ya dice lo que pasó.
--    · Se PIERDE si la organización se queda sin gestores.
--    · Sólo lo escriben el servidor y el equipo (por `reverify_location`). Un gestor puede
--      editar su fila de `center_info`, pero no puede sellarse a sí mismo: el trigger
--      `trg_center_info_guard` conserva el valor anterior.
--
-- 3. `reverify_location(id)`: el botón «Verificado hoy» de la cola de re-verificación.
--    Sella `last_confirmed_at` y, si la organización tiene gestor, renueva `verified_at`.
--
-- 4. `admin_metrics()`: cifras agregadas para el tablero del admin. Sólo staff. Devuelve
--    conteos, nunca filas de personas: el admin sigue sin ver la experiencia de nadie.
--
-- MIENTRAS NO SE CORRA, la app funciona igual: no sale el sello, «Seguir» no aparece, y el
-- tablero del admin dice que falta esta migración.
-- ===========================================================================

-- ── 1. Columnas en center_info ─────────────────────────────────────────────

alter table public.center_info
  add column if not exists verified_at     timestamptz,
  add column if not exists verified_by     uuid references auth.users(id) on delete set null;

comment on column public.center_info.verified_at is
  'Última verificación de la organización por el equipo. El sello vale 90 días '
  '(src/domain/verification.ts). Sólo lo escribe el servidor: trg_center_info_guard.';

-- El sello es del servidor. Quien escribe con su sesión (un gestor con su
-- upsert, o el equipo desde el formulario del punto) los deja como estaban: no hay error,
-- porque el formulario no los manda, y si alguien los manda a mano no consigue nada.
create or replace function private.guard_center_info()
returns trigger
language plpgsql
set search_path = public
as $guard$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified_at := null;
    new.verified_by := null;
  else
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
  end if;
  return new;
end
$guard$;

drop trigger if exists trg_center_info_guard on public.center_info;
create trigger trg_center_info_guard
  before insert or update on public.center_info
  for each row execute function private.guard_center_info();

-- ── 2. El sello sigue a los gestores ───────────────────────────────────────

create or replace function private.verify_on_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $vm$
begin
  if tg_op = 'INSERT' then
    insert into public.center_info (location_id, verified_at, verified_by)
    values (new.location_id, now(), new.invited_by)
    on conflict (location_id) do update
      set verified_at = now(), verified_by = excluded.verified_by;
    return null;
  end if;

  -- DELETE: sin nadie que hable por el punto, ya no hay organización que verificar.
  if not exists (select 1 from public.center_managers where location_id = old.location_id) then
    update public.center_info
       set verified_at = null, verified_by = null
     where location_id = old.location_id;
  end if;
  return null;
end
$vm$;

drop trigger if exists trg_center_managers_verify on public.center_managers;
create trigger trg_center_managers_verify
  after insert or delete on public.center_managers
  for each row execute function private.verify_on_manager();

-- Las organizaciones que YA tienen gestor pasaron por esa aprobación. Se sellan con la
-- fecha del último gestor aprobado y no con hoy: así la cola de re-verificación sabe
-- cuánto tiempo lleva cada una sin revisarse de verdad.
update public.center_info ci
   set verified_at = m.last_at
  from (
    select location_id, max(created_at) as last_at
    from public.center_managers
    group by location_id
  ) m
 where ci.location_id = m.location_id
   and ci.verified_at is null;

-- ── 3. Seguir ──────────────────────────────────────────────────────────────

create table if not exists public.center_follows (
  user_id     uuid not null references auth.users(id) on delete cascade,
  location_id text not null references public.locations(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, location_id)
);

create index if not exists center_follows_location_idx on public.center_follows (location_id);

alter table public.center_follows enable row level security;

drop policy if exists center_follows_read on public.center_follows;
create policy center_follows_read on public.center_follows
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists center_follows_insert on public.center_follows;
create policy center_follows_insert on public.center_follows
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.locations l where l.id = location_id and l.active)
  );

drop policy if exists center_follows_delete on public.center_follows;
create policy center_follows_delete on public.center_follows
  for delete to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.center_stats (
  location_id     text primary key references public.locations(id) on delete cascade,
  followers_count integer not null default 0
);

alter table public.center_stats enable row level security;

-- Público en lectura, como center_info. Nadie lo escribe salvo el trigger de abajo.
drop policy if exists center_stats_public_read on public.center_stats;
create policy center_stats_public_read on public.center_stats
  for select to anon, authenticated using (true);

create or replace function private.count_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $cf$
declare
  v_loc text := coalesce(new.location_id, old.location_id);
begin
  insert into public.center_stats (location_id, followers_count)
  values (v_loc, (select count(*) from public.center_follows where location_id = v_loc))
  on conflict (location_id) do update
    set followers_count = excluded.followers_count;
  return null;
end
$cf$;

drop trigger if exists trg_center_follows_count on public.center_follows;
create trigger trg_center_follows_count
  after insert or delete on public.center_follows
  for each row execute function private.count_followers();

-- ── 4. «Verificado hoy» ────────────────────────────────────────────────────

create or replace function public.reverify_location(p_location text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $rv$
declare
  v_now timestamptz := now();
  v_managed boolean;
begin
  if not private.can_edit((select emergency_id from public.locations where id = p_location)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  v_managed := exists (select 1 from public.center_managers where location_id = p_location);

  insert into public.center_info (location_id, last_confirmed_at, verified_at, verified_by)
  values (p_location, v_now,
          case when v_managed then v_now end,
          case when v_managed then auth.uid() end)
  on conflict (location_id) do update
    set last_confirmed_at = v_now,
        verified_at = case when v_managed then v_now else public.center_info.verified_at end,
        verified_by = case when v_managed then auth.uid() else public.center_info.verified_by end;

  return v_now;
end
$rv$;

revoke all on function public.reverify_location(text) from public, anon;
grant execute on function public.reverify_location(text) to authenticated;

-- ── 5. Tablero del admin ───────────────────────────────────────────────────
--
-- `p_stale_days` viene de la configuración del país (`map.staleAfterDays`): la misma regla
-- con la que el mapa marca un dato como viejo. Todo es conteo; ninguna fila de persona sale
-- de aquí.

create or replace function public.admin_metrics(p_stale_days integer default 21)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $am$
declare
  v_since timestamptz := now() - interval '30 days';
  v_out jsonb;
begin
  if not private.is_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  with
  pts as (
    select l.id, ci.last_confirmed_at, ci.updated_at, ci.verified_at,
           exists (select 1 from public.center_managers m where m.location_id = l.id) as managed
    from public.locations l
    left join public.center_info ci on ci.location_id = l.id
    where l.active
  ),
  rep as (
    select status, created_at, reviewed_at from public.point_reports
  ),
  sub as (
    select status, created_at, reviewed_at from public.submissions
  ),
  rep_done as (
    select extract(epoch from reviewed_at - created_at) / 3600 as h
    from rep where reviewed_at is not null and reviewed_at >= v_since
  ),
  sub_done as (
    select extract(epoch from reviewed_at - created_at) / 3600 as h
    from sub where reviewed_at is not null and reviewed_at >= v_since
  ),
  weeks as (
    select generate_series(date_trunc('week', now()) - interval '7 weeks',
                           date_trunc('week', now()), interval '1 week') as wk
  )
  select jsonb_build_object(
    'points', jsonb_build_object(
      'active',   (select count(*) from pts),
      'stale',    (select count(*) from pts
                    where coalesce(last_confirmed_at, updated_at) is null
                       or coalesce(last_confirmed_at, updated_at) < now() - make_interval(days => p_stale_days)),
      'confirmed30', (select count(*) from pts where last_confirmed_at >= v_since)
    ),
    'orgs', jsonb_build_object(
      'managed',  (select count(*) from pts where managed),
      'verified', (select count(*) from pts where managed and verified_at >= now() - interval '90 days'),
      'expiring', (select count(*) from pts where managed
                     and verified_at <  now() - interval '75 days'
                     and verified_at >= now() - interval '90 days'),
      'expired',  (select count(*) from pts where managed
                     and (verified_at is null or verified_at < now() - interval '90 days'))
    ),
    'people', jsonb_build_object(
      'accounts',   (select count(*) from public.profiles),
      'new30',      (select count(*) from public.profiles where created_at >= v_since),
      'volunteers', (select count(*) from public.profiles where cardinality(skills) > 0),
      'active30',   (select count(distinct user_id) from public.contributions where created_at >= v_since),
      'follows',    (select count(*) from public.center_follows),
      'follows30',  (select count(*) from public.center_follows where created_at >= v_since)
    ),
    'activity', jsonb_build_object(
      'campaigns',  (select count(*) from public.campaigns where status = 'active'),
      'posts30',    (select count(*) from public.initiative_posts where created_at >= v_since),
      'events',     (select count(*) from public.activities
                      where status = 'scheduled' and starts_at >= now()),
      'going',      (select coalesce(sum(going_count), 0) from public.activities
                      where status = 'scheduled' and starts_at >= now()),
      'attended30', (select count(*) from public.contributions
                      where kind = 'volunteer' and created_at >= v_since),
      'donations30',(select count(*) from public.donation_claims
                      where status = 'confirmed' and reviewed_at >= v_since),
      'checkins30', (select count(*) from public.contributions
                      where kind = 'checkin' and created_at >= v_since)
    ),
    'queues', jsonb_build_object(
      'reports_pending',      (select count(*) from rep where status = 'pending'),
      'reports_oldest_h',     (select round(extract(epoch from now() - min(created_at)) / 3600)
                                 from rep where status = 'pending'),
      'reports_median_h',     (select round(percentile_cont(0.5) within group (order by h)::numeric, 1) from rep_done),
      'reports_within36',     (select count(*) filter (where h <= 36) from rep_done),
      'reports_done30',       (select count(*) from rep_done),
      'subs_pending',         (select count(*) from sub where status = 'pending'),
      'subs_oldest_h',        (select round(extract(epoch from now() - min(created_at)) / 3600)
                                 from sub where status = 'pending'),
      'subs_median_h',        (select round(percentile_cont(0.5) within group (order by h)::numeric, 1) from sub_done),
      'subs_within36',        (select count(*) filter (where h <= 36) from sub_done),
      'subs_done30',          (select count(*) from sub_done),
      'manage_pending',       (select count(*) from public.manage_requests where status = 'pending')
    ),
    'weekly', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week', to_char(w.wk, 'YYYY-MM-DD'),
        'accounts', (select count(*) from public.profiles p
                      where p.created_at >= w.wk and p.created_at < w.wk + interval '1 week'),
        'actions',  (select count(*) from public.contributions c
                      where c.created_at >= w.wk and c.created_at < w.wk + interval '1 week')
      ) order by w.wk), '[]'::jsonb)
      from weeks w
    )
  ) into v_out;

  return v_out;
end
$am$;

revoke all on function public.admin_metrics(integer) from public, anon;
grant execute on function public.admin_metrics(integer) to authenticated;

notify pgrst, 'reload schema';
