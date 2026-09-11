-- ===========================================================================
-- db/07_aportes.sql — quien aporta lo dice, y la iniciativa lo confirma
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `014_aportes` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro.
--
-- ⚠️ Corre antes db/05_iniciativas.sql y db/06_reconocimiento.sql.
--
-- ---------------------------------------------------------------------------
-- EL PROBLEMA QUE RESUELVE
--
-- Aportar a una iniciativa vale 15 puntos de experiencia, más que ninguna otra cosa. Y
-- hasta ahora NADA los otorgaba, a propósito: {platform} no cobra ni custodia dinero
-- —ver `db/05_iniciativas.sql`— así que no hay ningún momento en el que la plataforma se
-- entere de que un aporte ocurrió. Darlos por declarados habría sido el agujero más
-- grande de todo el sistema: quince puntos por pulsar un botón, cincuenta veces al día.
--
-- Lo que sí existe es alguien que SÍ se entera: la propia iniciativa, cuando el dinero le
-- llega. Y desde `05_iniciativas.sql` esa iniciativa tiene gestor, cuenta y panel.
--
-- Así que el aporte se declara y queda PENDIENTE hasta que la iniciativa lo confirma. La
-- experiencia la otorga esa confirmación, igual que un aviso sobre un punto sólo cuenta
-- cuando el equipo lo aplica (`06_reconocimiento.sql` § 6).
--
-- ---------------------------------------------------------------------------
-- LO QUE ESTO NO ES
--
-- No es un registro contable ni una pasarela. No guarda importes, y no los guarda a
-- propósito: la plataforma no puede verificar una cifra que no ha movido, y un número sin
-- verificar junto a un nombre se lee como si estuviera verificado. Lo que se guarda es
-- que alguien dice haber aportado y que la iniciativa dice haberlo recibido — dos
-- afirmaciones, cada una de quien la hace.
--
-- El día que haya pasarela, el importe vendrá de ella y esto cambiará de forma. Hasta
-- entonces, esta tabla vale para una cosa: reconocer a quien ayudó, con el visto bueno de
-- quien fue ayudado.
-- ===========================================================================

create table if not exists public.donation_claims (
  id           uuid primary key default gen_random_uuid(),
  -- Quien dice haber aportado.
  user_id      uuid not null references auth.users(id) on delete cascade,
  location_id  text not null references public.locations(id) on delete cascade,
  -- A qué campaña, si fue a una. Null = a la iniciativa en general.
  campaign_id  uuid references public.campaigns(id) on delete set null,
  emergency_id uuid references public.emergencies(id) on delete cascade,

  -- Para que la iniciativa pueda reconocerlo: «transferencia del 8, referencia 1234».
  -- Texto corto y libre. NO hay campo de importe — ver la nota del encabezado.
  note         text check (note is null or length(note) <= 280),

  status       text not null default 'pending'
                 check (status in ('pending', 'confirmed', 'rejected')),

  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id) on delete set null
);

create index if not exists donation_claims_pending_idx
  on public.donation_claims (location_id, created_at desc) where status = 'pending';
create index if not exists donation_claims_mine_idx
  on public.donation_claims (user_id, created_at desc);

-- Un aporte pendiente por persona e iniciativa a la vez.
--
-- Sin esto, quien quiere inflar su nivel declara veinte aportes al mismo comedor y le deja
-- al gestor una cola de veinte para revisar. Uno cada vez: cuando el anterior se resuelve,
-- se puede declarar otro — que es el ritmo real de alguien que aporta de verdad.
create unique index if not exists donation_claims_one_pending
  on public.donation_claims (user_id, location_id) where status = 'pending';

alter table public.donation_claims enable row level security;

-- Declarar: cualquiera con sesión, en su propio nombre y como pendiente.
drop policy if exists donation_claims_insert on public.donation_claims;
create policy donation_claims_insert on public.donation_claims
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

-- Leer: lo propio, y quien gestiona ese punto (que es quien tiene que confirmarlo).
drop policy if exists donation_claims_read on public.donation_claims;
create policy donation_claims_read on public.donation_claims
  for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_location(location_id));

-- Resolver: quien gestiona el punto. Ni el que aportó ni nadie más.
drop policy if exists donation_claims_manage on public.donation_claims;
create policy donation_claims_manage on public.donation_claims
  for update to authenticated
  using (private.can_manage_location(location_id))
  with check (private.can_manage_location(location_id));


-- ===========================================================================
-- El gestor necesita ver UN nombre, y sólo ése
--
-- Confirmar un aporte es decir «sí, esto me llegó», y para eso hace falta saber de quién.
-- Pero `010_accounts` deja los perfiles cerrados a todo el que no sea del equipo, y un
-- gestor de centro NO es del equipo.
--
-- Se abre lo mínimo: un gestor puede leer el perfil de quien le declaró un aporte A ÉL, y
-- de nadie más. No es «los gestores ven los perfiles»; es «ve el nombre de quien le está
-- diciendo que le dio dinero», que es exactamente el dato que necesita para contestar.
--
-- El correo sigue sin estar en esta tabla, así que sigue sin verlo nadie.
-- ===========================================================================

drop policy if exists profiles_donor_read on public.profiles;
create policy profiles_donor_read on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.donation_claims d
      where d.user_id = profiles.user_id
        and private.can_manage_location(d.location_id)
    )
  );


-- ===========================================================================
-- La experiencia, cuando la iniciativa confirma
--
-- Mismo patrón que `reward_applied_report`: cuelga del hecho y no de la pantalla, así que
-- sigue funcionando si alguien confirma desde otro sitio. Y el valor sale de
-- `contribution_points`, nunca de un número escrito aquí.
-- ===========================================================================

create or replace function public.reward_confirmed_donation()
returns trigger
language plpgsql
security definer
set search_path = public
as $reward$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    insert into public.contributions (user_id, kind, location_id, points, emergency_id)
    values (
      new.user_id, 'donation', new.location_id,
      public.contribution_points('donation'), new.emergency_id
    )
    on conflict do nothing;
  end if;
  return new;
end
$reward$;

drop trigger if exists trg_donation_claims_reward on public.donation_claims;
create trigger trg_donation_claims_reward after update on public.donation_claims
  for each row execute function public.reward_confirmed_donation();

-- De dónde sale `emergency_id`: del punto, no de quien declara. Reusa la función que ya
-- creó `05_iniciativas.sql`.
drop trigger if exists trg_donation_claims_emergency on public.donation_claims;
create trigger trg_donation_claims_emergency before insert on public.donation_claims
  for each row execute function public.set_emergency_from_location();

-- Quién resolvió y cuándo. Lo pone la base y no la app: una fecha de revisión que manda
-- el cliente es una fecha que el cliente elige.
create or replace function public.stamp_donation_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $stamp$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
    new.reviewed_by := auth.uid();
  end if;
  return new;
end
$stamp$;

drop trigger if exists trg_donation_claims_stamp on public.donation_claims;
create trigger trg_donation_claims_stamp before update on public.donation_claims
  for each row execute function public.stamp_donation_review();

-- Bitácora: confirmar un aporte es lo que convierte una afirmación en experiencia.
drop trigger if exists trg_donation_claims_audit on public.donation_claims;
create trigger trg_donation_claims_audit after insert or update on public.donation_claims
  for each row execute function public.audit_row();


-- ---------------------------------------------------------------------------
-- Verificación
--
--   Con la sesión de quien aporta: declarar deja la fila en `pending` y NO suma nada.
--   Con la del gestor: pasar a `confirmed` crea la fila de `contributions` con 15.
--   Con la de un tercero: no ve el aporte ni puede resolverlo.
-- ---------------------------------------------------------------------------
