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
-- 5) Cómo se anota una contribución
--
-- `security definer` porque `contributions` no tiene política de INSERT: ésta es la única
-- puerta, y por eso valida aquí dentro en vez de confiar en quien llama.
--
-- Devuelve el total nuevo para que la app pueda decir «+2» sin volver a preguntar.
-- ===========================================================================

create or replace function public.record_contribution(
  p_kind        text,
  p_location_id text default null,
  p_points      int default 1
)
returns int
language plpgsql
security definer
set search_path = public
as $rec$
declare
  v_total int;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  -- Los puntos NO los elige quien llama por encima de un tope: sin esto, la firma de la
  -- función sería un formulario para regalarse la tabla de posiciones.
  if p_points is null or p_points < 0 or p_points > 5 then
    raise exception 'Valor de contribución fuera de rango.';
  end if;

  insert into public.contributions (user_id, kind, location_id, points, emergency_id)
  values (
    auth.uid(),
    p_kind,
    p_location_id,
    p_points,
    (select emergency_id from public.locations where id = p_location_id)
  )
  -- Repetir la misma acción el mismo día no falla: simplemente no suma. Un error aquí
  -- obligaría a la app a distinguir «ya lo hiciste» de «algo se rompió», y para quien
  -- escanea un QR dos veces las dos cosas son «ya está».
  on conflict do nothing;

  select coalesce(sum(points), 0)::int into v_total
    from public.contributions where user_id = auth.uid();
  return v_total;
end
$rec$;

revoke all on function public.record_contribution(text, text, int) from public;
grant execute on function public.record_contribution(text, text, int) to authenticated;

-- Otorgar una medalla. Idempotente: pedirla dos veces no la duplica ni cambia su fecha.
create or replace function public.award_badge(p_badge text)
returns boolean
language plpgsql
security definer
set search_path = public
as $award$
declare
  -- `row_count` es un ENTERO. Asignarlo a un boolean directamente es un error de tipos y
  -- plpgsql lo rechaza al ejecutarse, no al crear la función — así que habría pasado
  -- desapercibido hasta que alguien ganara su primera medalla.
  v_rows int := 0;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  insert into public.user_badges (user_id, badge)
  values (auth.uid(), p_badge)
  on conflict (user_id, badge) do nothing;
  get diagnostics v_rows = row_count;
  -- true sólo la primera vez: pedirla de nuevo no la duplica ni mueve su fecha.
  return v_rows > 0;
end
$award$;

revoke all on function public.award_badge(text) from public;
grant execute on function public.award_badge(text) to authenticated;



-- ===========================================================================
-- 6) La experiencia se gana por lo COMPROBADO, no por lo declarado
--
-- Este bloque es la respuesta a un agujero real. La primera versión sumaba experiencia al
-- ENVIAR un aviso sobre un punto, y eso deja abierto lo obvio: alguien pulsa «sigue
-- abierto» en cincuenta puntos distintos en una tarde y sube de nivel sin haber
-- comprobado nada. Con niveles que valdrán un beneficio en un comercio aliado, una
-- experiencia que se puede fabricar así no vale nada.
--
-- Así que la experiencia por un aviso se otorga cuando el EQUIPO lo aplica. Es el mismo
-- principio que `010_accounts` fijó para los avisos mismos —«un reporte es una SEÑAL, no
-- una escritura»— llevado a su consecuencia: si la señal sólo cuenta cuando alguien la
-- confirma, el reconocimiento tampoco puede contar antes.
--
-- Va en un TRIGGER y no en el panel del equipo a propósito. Si lo hiciera la aplicación
-- al resolver, se perdería en cuanto alguien resolviera un aviso desde otro sitio —un
-- script, la consola de Supabase, un panel futuro— y nadie se enteraría de que dejó de
-- funcionar. Aquí cuelga del hecho, no de la pantalla.
-- ===========================================================================

create or replace function public.reward_applied_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $reward$
begin
  -- Sólo al PASAR a aplicado, no cada vez que se guarde una fila que ya lo estaba.
  if new.status = 'applied' and old.status is distinct from 'applied' then
    insert into public.contributions (user_id, kind, location_id, points, emergency_id)
    values (new.user_id, 'report', new.location_id, 1, new.emergency_id)
    -- El índice de una-vez-al-día sigue mandando: dos avisos de la misma persona sobre el
    -- mismo punto, aplicados el mismo día, suman una vez.
    on conflict do nothing;
  end if;
  return new;
end
$reward$;

drop trigger if exists trg_point_reports_reward on public.point_reports;
create trigger trg_point_reports_reward after update on public.point_reports
  for each row execute function public.reward_applied_report();


-- ---------------------------------------------------------------------------
-- Verificación
--
--   select * from public.leaderboard;          -- vacío hasta que alguien opte por salir
--   select public.record_contribution('report', null, 1);
--
-- Y la que importa, con una sesión que no sea la tuya: `select * from contributions`
-- tiene que devolver CERO filas de otra persona, incluso siendo del equipo.
-- ---------------------------------------------------------------------------
