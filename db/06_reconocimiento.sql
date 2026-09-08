-- ===========================================================================
-- db/06_reconocimiento.sql — lo que alguien hizo, y qué se le reconoce por ello
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `013_reconocimiento` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro.
--
-- ⚠️ Corre antes db/05_iniciativas.sql si esa base todavía no lo tiene.
--
-- ---------------------------------------------------------------------------
-- QUÉ ES ESTO
--
-- Medallas y tabla de posiciones para quien ayuda: donar, confirmar que un punto sigue
-- abierto, aparecer en una jornada. Las medallas se canjean después por beneficios en
-- comercios patrocinantes — el comercio pone el beneficio y {platform} pone la constancia
-- de que esa persona ayudó.
--
-- ---------------------------------------------------------------------------
-- LA TENSIÓN QUE RESUELVE ESTE ARCHIVO, Y HAY QUE LEERLA ANTES DE TOCAR NADA
--
-- `010_accounts` dice, sobre `favourites`, que es la única tabla de la que un superadmin
-- no puede leer nada, «porque saber qué refugios guardó una persona es saber dónde piensa
-- ir o dónde estuvo».
--
-- Una tabla de posiciones construida sobre visitas a refugios dice EXACTAMENTE ESO, y
-- encima en público. Hecha de la forma obvia —una lista de quién estuvo dónde y cuántas
-- veces— sería la mayor fuga de datos de movimiento del proyecto, publicada a propósito,
-- en un país donde eso no es un problema abstracto.
--
-- Así que la regla de este archivo es una sola y gobierna todo lo demás:
--
--   LO QUE SE PUEDE VER DE OTRA PERSONA ES UN NÚMERO Y UN NOMBRE. NUNCA UN LUGAR.
--
-- En la práctica:
--
--   • `contributions` guarda `location_id` porque hace falta para no contar dos veces lo
--     mismo, pero NADIE lo lee salvo su dueño. Ni el equipo. La política es la de
--     `favourites`, copiada a conciencia.
--   • La tabla de posiciones sale de `leaderboard`, una vista que sólo expone nombre y
--     total. No hay forma de llegar desde ella a un punto del mapa.
--   • Y aparecer es OPT-IN. Quien no lo pide no sale, y hasta que alguien lo pida la
--     tabla está vacía — que es la respuesta correcta a «nadie ha querido salir».
-- ===========================================================================


-- ===========================================================================
-- 1) contributions — el libro mayor de lo que alguien hizo
--
-- Un apunte por acción, y los totales se SUMAN de aquí. Un contador en `profiles` habría
-- sido más rápido de leer y no se puede auditar: el día que un número esté mal, no hay
-- forma de saber de dónde salió ni de recalcularlo. Esto sí se recalcula.
-- ===========================================================================

create table if not exists public.contributions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  kind        text not null check (kind in (
                -- Escaneó el QR de un punto estando allí.
                'checkin',
                -- Reportó que un punto sigue abierto / ya cerró (`point_reports`).
                'report',
                -- Sugirió un punto que el equipo acabó publicando.
                'suggestion',
                -- Declaró un aporte a una iniciativa. Ver la nota de abajo.
                'donation',
                -- Apareció en una actividad que pedía voluntarios.
                'volunteer'
              )),

  -- Dónde. NADIE lo lee salvo su dueño — ver el encabezado. Está aquí porque sin él no se
  -- puede evitar que alguien sume cien veces por el mismo sitio en una tarde.
  location_id text references public.locations(id) on delete set null,
  emergency_id uuid references public.emergencies(id) on delete cascade,

  -- Cuánto suma. En la tabla y no en el código porque el valor de una acción cambia con
  -- el tiempo y lo ya ganado no se puede revaluar hacia atrás sin mentirle a alguien.
  points      int not null default 1 check (points between 0 and 100),

  created_at  timestamptz not null default now()
);

create index if not exists contributions_user_idx
  on public.contributions (user_id, created_at desc);

-- UNA contribución por persona, tipo y punto AL DÍA.
--
-- Es la única defensa real contra el bucle obvio: escanear el mismo QR veinte veces
-- seguidas, o pulsar «sigue abierto» hasta encabezar la lista. `date_trunc` a día y no a
-- hora porque volver a un refugio dos veces el mismo día es normal y no es una segunda
-- contribución.
-- `at time zone 'UTC'` no es adorno: `created_at::date` sobre un `timestamptz` NO es
-- inmutable —depende de la zona horaria de la sesión— y Postgres rechaza el índice. Fijar
-- la zona lo vuelve inmutable, y de paso hace que «el mismo día» signifique lo mismo para
-- todo el mundo en vez de moverse con la configuración de quien escribe.
create unique index if not exists contributions_once_a_day
  on public.contributions (
    user_id, kind, coalesce(location_id, ''), ((created_at at time zone 'UTC')::date)
  );

alter table public.contributions enable row level security;

-- Leer: SÓLO su dueño. Sin excepción para el equipo, igual que `favourites`, y por la
-- misma razón — esta tabla dice dónde estuvo alguien y qué día.
drop policy if exists contributions_own on public.contributions;
create policy contributions_own on public.contributions
  for select to authenticated using (user_id = (select auth.uid()));

-- Escribir: nadie, desde el cliente.
--
-- No hay política de INSERT a propósito. Si la hubiera, cualquiera con el token de su
-- propia sesión podría regalarse cien puntos con una petición desde la consola del
-- navegador, y una tabla de posiciones que se puede rellenar a mano no es una tabla de
-- posiciones. Los apuntes los crean funciones `security definer` (abajo) o el servidor
-- con el service role, siempre después de comprobar que la acción ocurrió de verdad.


-- ===========================================================================
-- 2) profiles: aparecer o no aparecer
--
-- Por defecto NO. Nadie entra en una lista pública por el hecho de ayudar, y menos aquí:
-- una lista de quién colabora con la ayuda humanitaria es, en algunos contextos, una
-- lista de a quién señalar.
-- ===========================================================================

alter table public.profiles
  add column if not exists leaderboard_opt_in boolean not null default false;


-- ===========================================================================
-- 3) La vista pública: un nombre y un número
--
-- `security_invoker = off` (lo de por defecto en una vista) hace que lea con los permisos
-- de quien la creó, que es lo que permite exponer un agregado de tablas que el visitante
-- no puede leer fila a fila. Ése es justo el punto: se ve el TOTAL, no de dónde sale.
--
-- No lleva `location_id` ni nada que lleve a él, y no puede llevarlo nunca.
-- ===========================================================================

create or replace view public.leaderboard as
  select
    p.user_id,
    p.display_name,
    coalesce(sum(c.points), 0)::int as points,
    count(c.id)::int                as actions
  from public.profiles p
  join public.contributions c on c.user_id = p.user_id
  where p.leaderboard_opt_in
  group by p.user_id, p.display_name
  having coalesce(sum(c.points), 0) > 0
  order by points desc, p.display_name asc;

-- Lectura pública de la vista. Lo que expone ya está acotado por su propia definición.
grant select on public.leaderboard to anon, authenticated;


-- ===========================================================================
-- 4) user_badges — qué medallas tiene alguien
--
-- El CATÁLOGO de medallas vive en el código (`src/domain/badges.ts`), no en una tabla:
-- son reglas, no datos, y una clonación nueva no debería tener que sembrar filas para que
-- exista la medalla de «primera ayuda». Aquí sólo se guarda quién ganó cuál y cuándo,
-- que es lo que sí es un hecho.
-- ===========================================================================

create table if not exists public.user_badges (
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- El `code` de `src/domain/badges.ts`. Texto y no enum: añadir una medalla no puede
  -- exigir una migración.
  badge      text not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge)
);

-- Las medallas NO se canjean: son hitos, y el canje en comercios va por NIVEL.
--
-- Estas dos columnas existieron en la primera versión de este archivo, cuando el plan era
-- cambiar medallas por beneficios. Se quitan en vez de dejarlas por si acaso: el propio
-- repositorio ya se dio ese golpe con `features.missingReports`, un interruptor que estuvo
-- encendido sin cablear, y la conclusión escrita allí es que un campo muerto es peor que
-- uno que no está. Cuando existan los comercios, lo que se registre será un canje contra
-- un nivel, y eso es otra tabla con otro nombre.
alter table public.user_badges drop column if exists redeemed_at;
alter table public.user_badges drop column if exists redeemed_note;

create index if not exists user_badges_user_idx on public.user_badges (user_id, awarded_at desc);

alter table public.user_badges enable row level security;

-- Leer: lo propio, y el equipo. El equipo las ve porque son el único rastro de actividad
-- de una persona que NO revela dónde estuvo: «tiene la medalla de siete días» se puede
-- mirar sin saber a qué refugios fue. Las contribuciones de las que salen, no.
drop policy if exists user_badges_read on public.user_badges;
create policy user_badges_read on public.user_badges
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

-- Sin política de UPDATE para nadie: una medalla se gana y ya está, no cambia después. La
-- que había existía para marcarlas canjeadas, y las medallas ya no se canjean.
drop policy if exists user_badges_staff_update on public.user_badges;


-- ===========================================================================
-- 5) Cuánto vale cada cosa, y quién lo decide
--
-- ── LA ESCALA, Y POR QUÉ ES TAN DESIGUAL ───────────────────────────────────
--
-- Confirmar desde el sofá que un punto sigue abierto vale 1. Presentarse allí, escanear su
-- código y que quede constancia vale 10. Aportar a una iniciativa, 15.
--
-- La diferencia es el producto entero. Lo que se quiere provocar es que alguien SALGA:
-- que visite un punto, vea lo que hace falta de verdad y ayude a varias causas por el
-- camino. Una escala plana premia por igual pulsar un botón cincuenta veces y cruzar la
-- ciudad, y entonces el nivel deja de significar «esta persona apareció» — que es
-- exactamente lo que un comercio aliado va a querer saber antes de dar un beneficio.
--
-- Con esta escala, llegar arriba sólo confirmando exigiría 250 confirmaciones y es
-- inviable a propósito. Con acciones físicas son unas veinte, que es una temporada de
-- alguien que de verdad está ayudando.
--
-- ── EL VALOR NO VIAJA EN LA LLAMADA ────────────────────────────────────────
--
-- La primera versión recibía `p_points` de quien llamaba. Con todo valiendo 1 era
-- tolerable; con un check-in valiendo 10 es un formulario para regalarse el nivel. Ahora
-- el valor sale de aquí dentro, y el que llama sólo dice QUÉ hizo.
-- ===========================================================================

create or replace function public.contribution_points(p_kind text)
returns int
language sql
immutable
as $pts$
  select case p_kind
    -- Desde el teléfono, sin moverse. Cuenta, pero poco.
    when 'report'     then 1
    when 'suggestion' then 3
    -- Hay que estar allí. Éstas son las que mueven el nivel.
    when 'checkin'    then 10
    when 'volunteer'  then 10
    when 'donation'   then 15
    else 0
  end;
$pts$;

/**
 * Anotar algo que alguien hizo.
 *
 * ── YA NO LA PUEDE LLAMAR EL CLIENTE ────────────────────────────────────────
 *
 * El `grant` a `authenticated` se retira más abajo. Mientras todo valía 1, que la app
 * llamara a esto era discutible; ahora que un check-in vale 10 y una donación 15, dejarlo
 * abierto sería poner el nivel a la venta por el precio de abrir la consola del navegador.
 *
 * Quien la llama es un TRIGGER (como `reward_applied_report`, que corre cuando el equipo
 * aplica un aviso) o el servidor con el service role, después de comprobar que la acción
 * ocurrió. Ésa es la única forma de que el nivel signifique algo comprobado.
 */
create or replace function public.record_contribution(
  p_kind        text,
  p_location_id text default null,
  p_user_id     uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $rec$
declare
  v_user  uuid := coalesce(p_user_id, auth.uid());
  v_total int;
begin
  if v_user is null then
    raise exception 'Falta a quién anotárselo.';
  end if;

  insert into public.contributions (user_id, kind, location_id, points, emergency_id)
  values (
    v_user,
    p_kind,
    p_location_id,
    public.contribution_points(p_kind),
    (select emergency_id from public.locations where id = p_location_id)
  )
  -- Repetir la misma acción el mismo día no falla: simplemente no suma. Un error aquí
  -- obligaría a quien llama a distinguir «ya lo hiciste» de «algo se rompió», y para
  -- quien escanea un QR dos veces las dos cosas son «ya está».
  on conflict do nothing;

  select coalesce(sum(points), 0)::int into v_total
    from public.contributions where user_id = v_user;
  return v_total;
end
$rec$;

-- La firma vieja, con `p_points`, se retira: mientras exista, existe el agujero.
drop function if exists public.record_contribution(text, text, int);

revoke all on function public.record_contribution(text, text, uuid) from public;
-- Sin `grant` a `authenticated`: ver la nota de arriba. Sólo triggers y service role.

-- ===========================================================================
-- 7) Las medallas las decide la BASE, no la aplicación
--
-- La primera versión las evaluaba en el cliente y llamaba a `award_badge` con el código
-- que hiciera falta. Como las medallas no dan permisos, parecía proporcionado — y no lo
-- era: cualquiera podía pedirse «Vigía» desde la consola del navegador sin haber
-- confirmado nada, y una distinción que se puede reclamar sola no distingue nada.
--
-- Ahora se otorgan solas, desde un trigger, contando lo que hay en `contributions`. El
-- cliente no participa: ni elige la medalla, ni el momento, ni puede pedirla.
--
-- ⚠️ ESTE BLOQUE Y `src/domain/badges.ts` SON LA MISMA REGLA ESCRITA DOS VECES. Aquí se
-- decide quién la tiene; allí sólo se dibuja. Si dejan de coincidir manda ésta, y lo que
-- se vería en pantalla sería una promesa que la base no cumple. Se cambian juntos.
-- ===========================================================================

create or replace function public.evaluate_badges(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $ev$
declare
  v_total     int;
  v_reports   int;
  v_donations int;
  v_volunteer int;
  v_days      int;
begin
  select
    count(*),
    count(*) filter (where kind = 'report'),
    count(*) filter (where kind = 'donation'),
    count(*) filter (where kind = 'volunteer'),
    count(distinct (created_at at time zone 'UTC')::date)
  into v_total, v_reports, v_donations, v_volunteer, v_days
  from public.contributions
  where user_id = p_user;

  -- `on conflict do nothing` en cada una: otorgar dos veces no duplica ni mueve la fecha
  -- de cuando se ganó, que es lo único que esa fila cuenta.
  if v_total     >= 1  then insert into public.user_badges (user_id, badge) values (p_user, 'first')     on conflict do nothing; end if;
  if v_reports   >= 5  then insert into public.user_badges (user_id, badge) values (p_user, 'confirmer') on conflict do nothing; end if;
  if v_reports   >= 25 then insert into public.user_badges (user_id, badge) values (p_user, 'lookout')   on conflict do nothing; end if;
  if v_donations >= 1  then insert into public.user_badges (user_id, badge) values (p_user, 'giver')     on conflict do nothing; end if;
  if v_volunteer >= 3  then insert into public.user_badges (user_id, badge) values (p_user, 'hands')     on conflict do nothing; end if;
  if v_days      >= 7  then insert into public.user_badges (user_id, badge) values (p_user, 'steady')    on conflict do nothing; end if;
end
$ev$;

-- Se evalúan al anotar una contribución, que es el único momento en que pueden cambiar.
create or replace function public.evaluate_badges_on_contribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $evc$
begin
  perform public.evaluate_badges(new.user_id);
  return new;
end
$evc$;

drop trigger if exists trg_contributions_badges on public.contributions;
create trigger trg_contributions_badges after insert on public.contributions
  for each row execute function public.evaluate_badges_on_contribution();

-- `award_badge` se retira. Mientras exista y sea llamable, existe el agujero.
drop function if exists public.award_badge(text);

-- Y `evaluate_badges` se cierra también. No podría otorgar nada indebido —cuenta lo que
-- de verdad hay en `contributions`— pero `create function` regala EXECUTE a PUBLIC, y una
-- función que nadie de fuera necesita llamar no tiene por qué estar expuesta.
revoke all on function public.evaluate_badges(uuid) from public;

-- Nadie las escribe a mano: sin políticas de INSERT ni UPDATE sobre `user_badges`, la
-- única vía es el trigger de arriba, que corre como definer.
drop policy if exists user_badges_insert on public.user_badges;


-- ---------------------------------------------------------------------------
-- Verificación
--
--   select * from public.leaderboard;          -- vacío hasta que alguien opte por salir
--   select public.record_contribution('report', null, 1);
--
-- Y la que importa, con una sesión que no sea la tuya: `select * from contributions`
-- tiene que devolver CERO filas de otra persona, incluso siendo del equipo.
-- ---------------------------------------------------------------------------
