-- ===========================================================================
-- db/05_iniciativas.sql — el perfil de una iniciativa deja de ser una ficha
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `012_iniciativas` de db/01_esquema.sql, para
-- aplicar encima de una base que ya corrió aquel archivo. Si cambias uno, cambia el otro.
--
-- ⚠️ Corre ANTES db/04_digitales.sql si esa base todavía no lo tiene.
--
-- ---------------------------------------------------------------------------
-- QUÉ CAMBIA Y POR QUÉ
--
-- Hasta aquí un punto era algo que el equipo describía: nombre, tipo, qué recibe, qué
-- necesita. La iniciativa no tenía voz — otra gente llenaba su ficha y ella miraba.
--
-- Eso funciona para un refugio en una emergencia aguda y falla para todo lo demás. Una
-- iniciativa que sostiene un comedor durante meses no gana nada por estar en un mapa que
-- sólo dice que existe, y un mapa al que las iniciativas no ganan nada por entrar se
-- queda sin iniciativas. Esto es lo que hace que le convenga entrar:
--
--   • CAMPAÑAS con una meta concreta — para qué, cuánto hace falta, hasta cuándo.
--   • AGENDA de lo que va a hacer en su comunidad, para que la gente de al lado pueda ir.
--   • ENTRADAS que cuentan lo que ya hizo, atadas a la campaña que lo pagó. Eso es la
--     trazabilidad: convierte «confía en nosotros» en algo que se puede mirar.
--
-- ---------------------------------------------------------------------------
-- LA REGLA DEL DINERO, Y ES LA MÁS IMPORTANTE DE ESTE ARCHIVO
--
-- {platform} NO cobra, no custodia y no reparte. La donación va directa de una persona a
-- la iniciativa, con los datos de cobro que la iniciativa misma publicó.
--
-- Consecuencia: `raised_amount` es lo que la iniciativa DICE que lleva recaudado. No es
-- un saldo. Nadie lo puede verificar desde aquí, y por eso la columna se llama como se
-- llama, guarda quién y cuándo lo declaró, y la app está obligada a mostrarlo como cifra
-- declarada. Una barra de progreso que parezca auditada cuando no lo está es peor que no
-- tener barra: sería exactamente la promesa que este proyecto dice no hacer.
--
-- Cuando exista el fondo común (ver el roadmap) habrá cifras que sí sean saldos. Irán en
-- otra tabla, con otro nombre, para que no se puedan confundir nunca con éstas.
--
-- ---------------------------------------------------------------------------
-- EL ROL «CENTRO», Y POR QUÉ NO ES UN `staff_users` MÁS
--
-- `staff_users` responde «¿es del equipo?» y `can_edit(emergency_id)` acota eso a una
-- emergencia. Quien dirige un comedor no es ninguna de las dos cosas: alcanza UN punto,
-- el suyo, y nada más — ni el de al lado, ni la cola de sugerencias, ni la bitácora.
--
-- Meterlo en `staff_users` con un rol nuevo habría hecho que `is_staff()` —que se llama
-- desde una docena de políticas escritas antes de que este rol existiera— empezara a
-- decir «sí» para él en todas ellas a la vez. Eso no es un permiso: es un agujero con
-- forma de refactor. Va en su propia tabla, y `is_staff()` sigue significando lo que
-- significaba.
--
-- La invitación es del equipo y sólo del equipo. Nadie reclama un punto por su cuenta:
-- poder publicar a nombre de un refugio es poder mandar gente a una puerta.
-- ===========================================================================


-- ===========================================================================
-- 1) center_managers — quién habla en nombre de un punto
-- ===========================================================================

create table if not exists public.center_managers (
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- `text` y no `uuid`: `locations.id` es text desde 001_core porque conserva el
  -- identificador con el que cada punto llegó de su fuente.
  location_id text not null references public.locations(id) on delete cascade,
  -- Quién lo invitó. Se guarda porque un permiso sin responsable no se puede revisar
  -- después, y éste es el permiso que deja publicar a nombre de otro.
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (user_id, location_id)
);

create index if not exists center_managers_location_idx
  on public.center_managers (location_id);

alter table public.center_managers enable row level security;

-- ¿Esta persona gestiona este punto?
--
-- security definer por lo mismo que `is_staff()`: se llama desde políticas RLS, así que
-- no puede depender de que quien consulta pueda leer la tabla. Y en `private`, como ella,
-- para que no sea además un endpoint de la API (ver `002_staff` en 01_esquema.sql).
--
-- ⚠️ En una base cuyas funciones de alcance siguen en `public` —la de un 01 viejo—, corre
-- antes db/11_privado.sql: sin `private.can_edit` esto no se puede crear.
create schema if not exists private;

create or replace function private.manages_location(loc_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.center_managers
    where user_id = auth.uid() and location_id = loc_id
  );
$$;

-- El permiso de escritura de todo este archivo, en una función: o gestionas ese punto, o
-- eres del equipo que alcanza la emergencia a la que pertenece.
create or replace function private.can_manage_location(loc_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select private.manages_location(loc_id)
     or private.can_edit((select emergency_id from public.locations where id = loc_id));
$$;

-- Leer: lo propio, y el equipo de esa emergencia. No es público a quién se invitó —
-- decir en abierto quién dirige un refugio es dar un nombre que nadie pidió publicar.
drop policy if exists center_managers_read on public.center_managers;
create policy center_managers_read on public.center_managers
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_edit((select emergency_id from public.locations where id = location_id))
  );

-- Invitar y revocar: sólo el equipo de esa emergencia.
drop policy if exists center_managers_staff_write on public.center_managers;
create policy center_managers_staff_write on public.center_managers
  for all to authenticated
  using (private.can_edit((select emergency_id from public.locations where id = location_id)))
  with check (private.can_edit((select emergency_id from public.locations where id = location_id)));

-- Un gestor mantiene al día lo suyo: qué necesita hoy, el horario, si está abierto.
--
-- Sí puede tocar `center_info`, y no es una contradicción con `point_reports` (010): allí
-- lo que se frena es una cuenta con un correo confirmado, que no es nadie verificado. A
-- un gestor lo invitó el equipo a dedo y se le revoca igual de rápido. Quien mejor sabe
-- si su comedor abrió hoy es su comedor.
--
-- Lo que NO puede tocar es `locations`: nombre, tipo y coordenadas los mantiene el
-- equipo. Mover un pin manda gente al lugar equivocado, y ese error no lo arregla quien
-- lo comete.
drop policy if exists center_info_manager_update on public.center_info;
create policy center_info_manager_update on public.center_info
  for update to authenticated
  using (private.manages_location(location_id))
  with check (private.manages_location(location_id));

-- Y CREARLA, que es lo que faltaba y tenía el onboarding roto ENTERO.
--
-- `center_info` es 1:1 con `locations` pero no nace con el punto: el equipo da de alta la
-- fila en `locations` y la ficha se rellena después, en el onboarding. Por eso el
-- onboarding guarda con un upsert — y ahí está el detalle que costó encontrar: un upsert
-- es `insert … on conflict do update`, así que Postgres exige la política de INSERT
-- SIEMPRE, haya fila o no. Sin ella el primer «Seguir» devolvía 403 y NINGÚN gestor podía
-- terminar de darse de alta, ni siquiera sobre un punto que ya tenía su ficha hecha.
--
-- La frontera no se mueve: es la misma `manages_location` de la política de arriba, de
-- modo que un gestor sólo puede estrenar la ficha DE SU PUNTO.
drop policy if exists center_info_manager_insert on public.center_info;
create policy center_info_manager_insert on public.center_info
  for insert to authenticated
  with check (private.manages_location(location_id));


-- ===========================================================================
-- 2) campaigns — «120 colchonetas antes del viernes»
--
-- Recaudar «para el comedor» no mueve a nadie. La meta concreta es la función.
-- ===========================================================================

create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  location_id  text not null references public.locations(id) on delete cascade,
  -- Copiado del punto por trigger, como en `point_reports`: el navegador no tiene por qué
  -- saberlo, y si lo mandara podría colar una campaña en otra emergencia.
  emergency_id uuid references public.emergencies(id) on delete cascade,

  title        text not null check (length(trim(title)) between 3 and 80),
  -- Para qué es. Obligatorio: una campaña sin destino declarado es la que no se puede
  -- rendir después.
  purpose      text not null check (length(trim(purpose)) between 10 and 600),

  -- La meta. `goal_unit` es texto libre porque la mitad de las campañas reales de este
  -- mapa no se miden en dinero: son colchonetas, kits de higiene, bombonas, almuerzos.
  -- Un enum aquí obligaría a un despliegue nuevo cada vez que a alguien le hace falta
  -- algo que no estaba en la lista.
  goal_amount  numeric(14,2) not null check (goal_amount > 0),
  goal_unit    text not null check (length(trim(goal_unit)) between 1 and 24),

  -- ⚠️ DECLARADO, NO VERIFICADO. Ver la nota del encabezado. La app está obligada a
  -- mostrarlo como lo que es.
  raised_amount     numeric(14,2) not null default 0 check (raised_amount >= 0),
  raised_declared_at timestamptz,
  raised_declared_by uuid references auth.users(id) on delete set null,

  starts_on    date not null default current_date,
  -- Sin fecha de cierre una campaña se queda abierta para siempre y el mapa se llena de
  -- metas que nadie va a cerrar. Opcional, pero la app la pide.
  ends_on      date,

  status       text not null default 'draft'
                 check (status in ('draft','active','reached','closed')),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint campaigns_dates_ordered check (ends_on is null or ends_on >= starts_on)
);

create index if not exists campaigns_location_idx
  on public.campaigns (location_id, starts_on desc);
create index if not exists campaigns_live_idx
  on public.campaigns (emergency_id, starts_on desc) where status in ('active','reached');

drop trigger if exists trg_campaigns_touch on public.campaigns;
create trigger trg_campaigns_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();


-- ===========================================================================
-- 3) activities — lo que va a hacer en su comunidad
--
-- La otra mitad de por qué a una iniciativa le conviene estar aquí: no sólo pedir, sino
-- convocar. La gente de al lado puede ir, llevar algo o sumarse.
-- ===========================================================================

create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  location_id  text not null references public.locations(id) on delete cascade,
  emergency_id uuid references public.emergencies(id) on delete cascade,

  title        text not null check (length(trim(title)) between 3 and 100),
  description  text check (description is null or length(description) <= 600),

  starts_at    timestamptz not null,
  ends_at      timestamptz,

  -- Dónde. Texto y no coordenadas a propósito: una jornada de la iniciativa suele ser en
  -- otro sitio que su sede —una plaza, una escuela— y ese sitio no es un punto del mapa
  -- ni debe convertirse en uno. Vacío = en la sede.
  place        text check (place is null or length(place) <= 160),

  -- Si hace falta gente. Es el enganche del voluntariado con lo que ya existe.
  needs_volunteers boolean not null default false,

  status       text not null default 'scheduled'
                 check (status in ('draft','scheduled','done','cancelled')),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint activities_times_ordered check (ends_at is null or ends_at >= starts_at)
);

-- El índice que sirve a la pantalla real: «qué hay a partir de ahora», por punto.
create index if not exists activities_upcoming_idx
  on public.activities (location_id, starts_at) where status = 'scheduled';

drop trigger if exists trg_activities_touch on public.activities;
create trigger trg_activities_touch before update on public.activities
  for each row execute function public.touch_updated_at();


-- ===========================================================================
-- 4) initiative_posts — lo que ya hizo
--
-- Es la trazabilidad y, a la vez, el primer ladrillo del feed de la fase siguiente. Por
-- eso no se llama `campaign_updates`: una entrada puede colgar de una campaña (y entonces
-- es la rendición de esa campaña) o ir suelta (y entonces es lo que la iniciativa cuenta).
--
-- `photo_url` y no un blob: las fotos van a un bucket de almacenamiento aparte. La
-- columna existe desde ya para que subir fotos no obligue a migrar la tabla después.
-- ===========================================================================

create table if not exists public.initiative_posts (
  id           uuid primary key default gen_random_uuid(),
  location_id  text not null references public.locations(id) on delete cascade,
  emergency_id uuid references public.emergencies(id) on delete cascade,

  -- Null = entrada suelta. Con campaña = «esto es lo que se hizo con lo que dieron».
  -- `on delete set null` y no cascade: si se borra la campaña, lo que se entregó SIGUE
  -- habiendo pasado. Borrar la prueba junto con la meta es justo lo que no debe poder
  -- hacerse en la tabla que existe para poder rendir cuentas.
  campaign_id  uuid references public.campaigns(id) on delete set null,

  kind         text not null default 'avance'
                 check (kind in ('avance','entrega','necesidad')),
  body         text not null check (length(trim(body)) between 3 and 1200),
  photo_url    text,

  status       text not null default 'published'
                 check (status in ('draft','published','hidden')),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists initiative_posts_location_idx
  on public.initiative_posts (location_id, created_at desc) where status = 'published';
create index if not exists initiative_posts_campaign_idx
  on public.initiative_posts (campaign_id, created_at desc) where campaign_id is not null;

drop trigger if exists trg_initiative_posts_touch on public.initiative_posts;
create trigger trg_initiative_posts_touch before update on public.initiative_posts
  for each row execute function public.touch_updated_at();


-- ===========================================================================
-- 5) De dónde sale `emergency_id`: del PUNTO, no de quien escribe
-- ===========================================================================

create or replace function public.set_emergency_from_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $set$
begin
  select l.emergency_id into new.emergency_id
    from public.locations l where l.id = new.location_id;
  return new;
end
$set$;

drop trigger if exists trg_campaigns_emergency on public.campaigns;
create trigger trg_campaigns_emergency before insert on public.campaigns
  for each row execute function public.set_emergency_from_location();

drop trigger if exists trg_activities_emergency on public.activities;
create trigger trg_activities_emergency before insert on public.activities
  for each row execute function public.set_emergency_from_location();

drop trigger if exists trg_initiative_posts_emergency on public.initiative_posts;
create trigger trg_initiative_posts_emergency before insert on public.initiative_posts
  for each row execute function public.set_emergency_from_location();


-- ===========================================================================
-- 6) Quién sella `raised_declared_at` / `raised_declared_by`
--
-- No se le pide a la app: una cifra de recaudación sin fecha se lee como si fuera de hoy,
-- y ésa es precisamente la lectura que no queremos regalar. La pone la base cuando el
-- número cambia, con quien lo cambió.
-- ===========================================================================

create or replace function public.stamp_raised_declaration()
returns trigger
language plpgsql
security definer
set search_path = public
as $stamp$
begin
  if new.raised_amount is distinct from old.raised_amount then
    new.raised_declared_at := now();
    new.raised_declared_by := auth.uid();
  end if;
  return new;
end
$stamp$;

drop trigger if exists trg_campaigns_raised on public.campaigns;
create trigger trg_campaigns_raised before update on public.campaigns
  for each row execute function public.stamp_raised_declaration();


-- ===========================================================================
-- 7) Quién ve qué
--
-- Lectura pública SOLO de lo publicado y SOLO de puntos activos. El `exists` sobre
-- `locations` no es adorno: sin él, desactivar un punto —que es como se retira del mapa
-- algo que dejó de existir— seguiría dejando sus campañas a la vista, pidiendo dinero
-- para un comedor que cerró.
-- ===========================================================================

alter table public.campaigns enable row level security;
alter table public.activities enable row level security;
alter table public.initiative_posts enable row level security;

drop policy if exists campaigns_public_read on public.campaigns;
create policy campaigns_public_read on public.campaigns
  for select to anon, authenticated
  using (
    status in ('active','reached','closed')
    and exists (select 1 from public.locations l where l.id = location_id and l.active)
  );

drop policy if exists activities_public_read on public.activities;
create policy activities_public_read on public.activities
  for select to anon, authenticated
  using (
    status in ('scheduled','done','cancelled')
    and exists (select 1 from public.locations l where l.id = location_id and l.active)
  );

drop policy if exists initiative_posts_public_read on public.initiative_posts;
create policy initiative_posts_public_read on public.initiative_posts
  for select to anon, authenticated
  using (
    status = 'published'
    and exists (select 1 from public.locations l where l.id = location_id and l.active)
  );

-- Quien puede gestionar ese punto lo ve TODO lo suyo, borradores incluidos, y escribe.
-- Una política por tabla y por verbo, en vez de un `for all`, porque `for all` con un
-- `using` que mira otra tabla se evalúa también en el INSERT y ahí `location_id` todavía
-- no está donde la política lo busca.

drop policy if exists campaigns_manager_read on public.campaigns;
create policy campaigns_manager_read on public.campaigns
  for select to authenticated using (private.can_manage_location(location_id));

drop policy if exists campaigns_manager_insert on public.campaigns;
create policy campaigns_manager_insert on public.campaigns
  for insert to authenticated with check (private.can_manage_location(location_id));

drop policy if exists campaigns_manager_update on public.campaigns;
create policy campaigns_manager_update on public.campaigns
  for update to authenticated
  using (private.can_manage_location(location_id))
  with check (private.can_manage_location(location_id));

drop policy if exists activities_manager_read on public.activities;
create policy activities_manager_read on public.activities
  for select to authenticated using (private.can_manage_location(location_id));

drop policy if exists activities_manager_insert on public.activities;
create policy activities_manager_insert on public.activities
  for insert to authenticated with check (private.can_manage_location(location_id));

drop policy if exists activities_manager_update on public.activities;
create policy activities_manager_update on public.activities
  for update to authenticated
  using (private.can_manage_location(location_id))
  with check (private.can_manage_location(location_id));

drop policy if exists initiative_posts_manager_read on public.initiative_posts;
create policy initiative_posts_manager_read on public.initiative_posts
  for select to authenticated using (private.can_manage_location(location_id));

drop policy if exists initiative_posts_manager_insert on public.initiative_posts;
create policy initiative_posts_manager_insert on public.initiative_posts
  for insert to authenticated with check (private.can_manage_location(location_id));

drop policy if exists initiative_posts_manager_update on public.initiative_posts;
create policy initiative_posts_manager_update on public.initiative_posts
  for update to authenticated
  using (private.can_manage_location(location_id))
  with check (private.can_manage_location(location_id));

-- Borrar: sólo un admin, y sólo campañas y actividades. `initiative_posts` NO tiene
-- política de DELETE para nadie — es la tabla de las pruebas de entrega, y una prueba que
-- su autor puede hacer desaparecer no prueba nada. Para retirar una entrada está
-- `status = 'hidden'`, que deja la fila donde estaba.
drop policy if exists campaigns_admin_delete on public.campaigns;
create policy campaigns_admin_delete on public.campaigns
  for delete to authenticated using (private.is_admin());

drop policy if exists activities_admin_delete on public.activities;
create policy activities_admin_delete on public.activities
  for delete to authenticated using (private.is_admin());


-- ===========================================================================
-- 8) Bitácora
--
-- Publicar una meta de recaudación a nombre de una iniciativa es exactamente el tipo de
-- cambio que hay que poder mirar después. `audit_row()` viene de 004.
-- ===========================================================================

drop trigger if exists trg_campaigns_audit on public.campaigns;
create trigger trg_campaigns_audit after insert or update or delete on public.campaigns
  for each row execute function public.audit_row();

drop trigger if exists trg_center_managers_audit on public.center_managers;
create trigger trg_center_managers_audit after insert or delete on public.center_managers
  for each row execute function public.audit_row();


-- ===========================================================================
-- 9) Datos de cobro propios y marca de onboarding
--
-- `donations` (005) es el directorio de ORGANIZACIONES que reciben aportes, y es otra
-- cosa: no está atada a un punto del mapa y la mantiene el equipo. Lo que hace falta aquí
-- es que un comedor concreto pueda recibir directamente, desde su propia ficha, con los
-- datos que él mismo puso. Van en `center_info` —que es donde vive lo que el punto dice
-- de sí mismo— y no en `locations`, que es dónde está y no cambia casi nunca.
--
-- Texto libre y no columnas por banco, por lo mismo que en `donations.donate_info`: los
-- rieles cambian por país y por organización (pago móvil, Zelle, transferencia, un
-- enlace), y la app lo muestra con un botón de copiar para pegarlo tal cual.
--
-- ⚠️ La plataforma NO se pone en medio: este dato es de la iniciativa y el dinero va
-- directo a ella. Ver la nota del encabezado.
-- ===========================================================================

alter table public.center_info add column if not exists donate_info text;
alter table public.center_info add column if not exists donate_url text;

-- Cuándo quedó completo el perfil, y por tanto el punto operativo como iniciativa.
--
-- Null no significa «mal punto»: los cientos de puntos que el equipo publicó a mano no
-- pasaron por ningún onboarding y funcionan igual. Significa «nadie de esta iniciativa ha
-- terminado de contar lo suyo», y es lo que decide si al gestor se le sigue enseñando el
-- onboarding al entrar.
alter table public.center_info add column if not exists onboarded_at timestamptz;


-- ===========================================================================
-- 10) center_invites — cómo entra un gestor
--
-- EL FLUJO, y el porqué de cada pieza:
--
--   equipo invita → la persona abre el enlace → canjea → ONBOARDING → operativa
--
-- El onboarding no es un trámite antes de lo bueno: es lo bueno. Alguien a quien acaban
-- de dar las llaves de su punto llega con la información en la cabeza —el horario, qué
-- hace falta, por dónde recibe— y ése es el único momento en que la va a escribir entera.
-- Una invitación que deja a alguien dentro con un perfil vacío gasta esa oportunidad.
--
-- Por eso `accept_center_invite` deja la fila en `center_managers` y NADA más: no marca
-- nada como completo. `center_info.onboarded_at` lo pone el último paso del onboarding.
-- ===========================================================================

create table if not exists public.center_invites (
  id          uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations(id) on delete cascade,

  -- El secreto del enlace. `gen_random_bytes` y no `gen_random_uuid()`: un uuid v4 tiene
  -- 122 bits y se ve como un identificador que la gente pega en cualquier sitio; esto son
  -- 32 bytes que se leen como lo que son, una llave.
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),

  -- A quién iba dirigida. Opcional, y cuando está puesto SE COMPRUEBA al canjear: un
  -- enlace reenviado por WhatsApp no puede convertir en gestor de un refugio a quien lo
  -- reciba de rebote. Sin correo, la invitación vale para quien tenga el enlace, que es
  -- lo que hace falta donde el correo no es el canal.
  email       text,

  invited_by  uuid references auth.users(id) on delete set null,
  -- Corta sola. Una invitación viva para siempre es una llave perdida que sigue abriendo.
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists center_invites_pending_idx
  on public.center_invites (location_id, created_at desc) where accepted_at is null;

alter table public.center_invites enable row level security;

-- Sólo el equipo de esa emergencia ve y crea invitaciones. NADIE más: la tabla guarda el
-- token en claro, y una política de lectura generosa aquí es entregar las llaves.
--
-- Quien canjea no lee esta tabla — usa la función de abajo, que corre como definer.
drop policy if exists center_invites_staff_all on public.center_invites;
create policy center_invites_staff_all on public.center_invites
  for all to authenticated
  using (private.can_edit((select emergency_id from public.locations where id = location_id)))
  with check (private.can_edit((select emergency_id from public.locations where id = location_id)));

/**
 * Canjear una invitación.
 *
 * `security definer` porque quien la llama no puede —ni debe— leer `center_invites`. La
 * función es la única puerta, y por eso valida todo aquí dentro:
 *
 *   • que el token exista,
 *   • que no esté ya canjeada,
 *   • que no haya caducado,
 *   • y que, si la invitación nombraba un correo, sea el correo de quien llama.
 *
 * Devuelve el `location_id` para que la app sepa a qué punto llevar el onboarding.
 * Levanta excepción en vez de devolver null en el caso malo: un fallo silencioso aquí
 * deja a alguien mirando una pantalla que no explica por qué no pasó nada.
 */
create or replace function public.accept_center_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $accept$
declare
  v_inv    public.center_invites%rowtype;
  v_email  text;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión para aceptar una invitación.';
  end if;

  select * into v_inv from public.center_invites where token = p_token;

  if not found then
    raise exception 'Esa invitación no existe.';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Esa invitación ya se usó.';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Esa invitación caducó.';
  end if;

  -- El correo se compara en minúsculas y sin espacios: quien invita lo escribe a mano.
  if v_inv.email is not null then
    select lower(trim(email)) into v_email from auth.users where id = auth.uid();
    if v_email is distinct from lower(trim(v_inv.email)) then
      raise exception 'Esa invitación es para otra cuenta.';
    end if;
  end if;

  insert into public.center_managers (user_id, location_id, invited_by)
  values (auth.uid(), v_inv.location_id, v_inv.invited_by)
  on conflict (user_id, location_id) do nothing;

  update public.center_invites
     set accepted_at = now(), accepted_by = auth.uid()
   where id = v_inv.id;

  return v_inv.location_id;
end
$accept$;

-- `anon` no: aceptar exige sesión, y la primera línea de la función ya lo dice. Dárselo a
-- `anon` sólo cambiaría el mensaje de error por uno peor. Se le quita por nombre porque
-- Supabase se lo da por nombre, y eso no lo quita el revoke de PUBLIC.
revoke all on function public.accept_center_invite(text) from public, anon;
grant execute on function public.accept_center_invite(text) to authenticated;

-- Bitácora: repartir las llaves de un punto es lo que hay que poder mirar después.
drop trigger if exists trg_center_invites_audit on public.center_invites;
create trigger trg_center_invites_audit after insert or update on public.center_invites
  for each row execute function public.audit_row();


-- ---------------------------------------------------------------------------
-- Verificación
--
--   select count(*) from public.campaigns;            -- 0, y la tabla existe
--   select private.manages_location('cualquier-id');   -- false sin sesión
--
-- Y la comprobación que importa, con una sesión anónima: una campaña en `draft` no debe
-- salir, y una campaña `active` de un punto con `active = false` tampoco.
-- ---------------------------------------------------------------------------
