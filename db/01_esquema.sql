-- ===========================================================================
-- HelpMaps · EL ESQUEMA. Esto es lo que hace falta para levantar un despliegue.
-- ===========================================================================
--
-- Córrelo entero, de una vez, en el editor SQL de un proyecto Supabase nuevo. Después
-- `02_emergencia.sql` (qué país es este despliegue) y `03_verificacion.sql` (comprobar
-- que no hay nada expuesto). Con esos tres archivos la base queda lista.
--
-- Idempotente de principio a fin: correrlo dos veces no rompe nada ni duplica nada.
-- Es agnóstico de país — acá no hay una sola coordenada, ni un color, ni una palabra en
-- español que dependa de dónde se despliegue. Eso vive en `02_emergencia.sql`.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ ESTE ARCHIVO Y NO `db/schema.sql`
--
-- `schema.sql` es un volcado de contexto y lo dice en su primera línea: "no está pensado
-- para ejecutarse". Tiene las 15 tablas y NADA más — cero políticas, cero RLS, cero
-- funciones, cero triggers, cero índices.
--
-- En este proyecto eso no es una omisión menor. El navegador habla con Supabase
-- DIRECTAMENTE con la anon key, que es pública por diseño, así que RLS no es una capa más
-- de defensa: es TODA la defensa. Una base levantada desde `schema.sql` tendría las 15
-- tablas legibles y escribibles por cualquiera — `submissions`, `volunteer_requests`,
-- `audit_log`, `staff_users`, `profiles`, `favourites` —, o sea los nombres, correos y
-- teléfonos de quien pidió ayuda o se ofreció a darla.
--
-- Lo que este archivo añade sobre aquél: 45 políticas, 13 funciones, 14 triggers, los
-- índices y `enable row level security` en las 15 tablas.
--
-- ---------------------------------------------------------------------------
-- CÓMO SE CONSTRUYÓ, Y POR QUÉ SE PUEDE CONFIAR EN ÉL
--
-- Es la concatenación EN ORDEN de las diez migraciones que se fueron aplicando
-- (001…010), no una reescritura a mano. Correrlo equivale exactamente a correrlas una
-- tras otra, que es lo que se hizo contra la base real.
--
-- Y está verificado contra producción, no contra la lectura de nadie: se introspeccionó
-- la base viva (`pg_policies`, `pg_proc`, `pg_trigger`, `pg_indexes`) y se comparó objeto
-- por objeto. 13 funciones y 14 triggers, idénticos. 45 políticas finales, idénticas.
-- Cero desviaciones.
--
-- ⚠️ HAY REDEFINICIONES A PROPÓSITO, y por eso el orden no se puede alterar:
--
--   `is_admin()`   se define en 002 y 008 la REESCRIBE para que un superadmin cuente
--                  también como admin.
--   `audit_row()`  se define en 004 y 006 la REESCRIBE para que el registro sepa a qué
--                  emergencia pertenece cada cambio.
--   17 políticas   creadas en 001…005 sin alcance, y 008 las suelta y las recrea
--                  acotadas por emergencia. Por eso hay 62 sentencias `create policy`
--                  y sólo 45 políticas al final: gana la última, como en producción.
--
-- Mover una sección hacia arriba deja la definición VIEJA como buena. No lanza ningún
-- error: simplemente deja la base con menos protección de la que cree tener.
-- ===========================================================================




-- ###########################################################################
-- ### 001_core
-- ###########################################################################

-- HelpMaps · esquema base (1 de 4) — corre esto PRIMERO en el proyecto Supabase de este país.
--
-- Idempotente: se puede volver a correr sin romper nada.
--
-- Decisión de diseño que importa al clonar: `locations.region` es TEXT, no un enum.
-- La versión anterior usaba un enum de Postgres por país y agregar una región exigía
-- `ALTER TYPE` antes de poder insertar una sola fila — un bloqueo en plena emergencia.
-- Aquí las regiones válidas viven en `src/country/presets/<pais>.ts` y el panel de staff
-- solo ofrece esas. El costo aceptado: un INSERT hecho a mano por SQL puede escribir una
-- región que la app no conoce; esa fila aparece en el mapa pero no en el filtro por
-- región. La consulta al final de este archivo las encuentra.

-- ---------------------------------------------------------------------------
-- updated_at: se toca solo cuando la fila REALMENTE cambió.
-- Un pipeline que reescribe todas las filas cada 5 minutos, si no, deja "actualizado
-- hace 1 minuto" en puntos que nadie confirmó hace semanas — y esa fecha es justo lo
-- que una familia usa para decidir si el lugar sigue abierto.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and to_jsonb(new) - 'updated_at' is not distinct from to_jsonb(old) - 'updated_at' then
    return old;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- locations — el objetivo de todos los joins: pines, filtros, rutas de detalle.
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id            text primary key,
  name          text not null,
  type          text not null check (type in
                  ('shelter','donation_centre','comedor','iniciativa','hospital','morgue')),
  -- Código de región. Debe coincidir con un `Region.code` del CountryConfig activo.
  region        text,
  municipality  text,
  lat           double precision not null,
  lng           double precision not null,
  address       text,
  phone         text,
  whatsapp      text,
  aliases       text[] not null default '{}',
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists locations_active_idx on public.locations (active) where active;
create index if not exists locations_region_idx on public.locations (region);
create index if not exists locations_type_idx on public.locations (type);

drop trigger if exists trg_locations_touch on public.locations;
create trigger trg_locations_touch before update on public.locations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- center_info — 1:1 con locations: qué RECIBE y qué NECESITA este punto ahora.
--
-- Tabla aparte a propósito: las necesidades cambian a diario, la ubicación casi nunca,
-- y las edita gente distinta con expectativas distintas.
--
-- `status` NULL significa DESCONOCIDO y así debe mostrarse. Nada, en ninguna capa,
-- puede asumir 'abierto' por defecto: decir que un punto cerrado está abierto es el
-- único error de este campo que manda a una familia a una puerta cerrada.
-- ---------------------------------------------------------------------------
create table if not exists public.center_info (
  location_id       text primary key references public.locations(id) on delete cascade,
  status            text check (status in ('abierto','lleno','cerrado')),
  receives          text[] not null default '{}',
  needs             text,
  help              text[] not null default '{}'
                      check (help <@ array['voluntariado','especie','oficios','difusion','economico']::text[]),
  category          text,
  description       text,
  schedule          text,
  contact_name      text,
  social_url        text,
  is_animal         boolean not null default false,
  last_confirmed_at timestamptz,
  source            text,
  external_id       text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists center_info_status_idx on public.center_info (status);

drop trigger if exists trg_center_info_touch on public.center_info;
create trigger trg_center_info_touch before update on public.center_info
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- app_settings — una sola fila. Mantenimiento y aviso global.
--
-- Cuando el equipo baja los datos para reverificarlos, el mapa queda vacío a propósito
-- y sin aviso se lee como "no hay nadie" — alarmante para quien busca ayuda. La app
-- sigue usable: esto es un aviso, nunca un bloqueo.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id          boolean primary key default true check (id),
  maintenance boolean not null default false,
  notice      text,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS — lectura pública, escritura solo de staff (se define en 002_staff.sql).
--
-- Con la app escribiendo directo a estas tablas usando la anon key, RLS es lo ÚNICO
-- que protege los datos. No asumas que está bien: corre db/03_verificacion.sql.
-- ---------------------------------------------------------------------------
alter table public.locations   enable row level security;
alter table public.center_info enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists locations_public_read on public.locations;
create policy locations_public_read on public.locations
  for select to anon, authenticated using (true);

drop policy if exists center_info_public_read on public.center_info;
create policy center_info_public_read on public.center_info
  for select to anon, authenticated using (true);

drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read on public.app_settings
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Verificación: filas cuya región la app no conoce (typos de un INSERT manual).
-- Compara este resultado con `regions` en el preset del país.
--   select region, count(*) from public.locations group by 1 order by 2 desc;
-- ---------------------------------------------------------------------------


-- ###########################################################################
-- ### 002_staff
-- ###########################################################################

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


-- ###########################################################################
-- ### 003_submissions
-- ###########################################################################

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


-- ###########################################################################
-- ### 004_audit_log
-- ###########################################################################

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


-- ###########################################################################
-- ### 005_donations
-- ###########################################################################

-- HelpMaps · directorio de donaciones (5 de 5) — corre esto DESPUÉS de 004_audit_log.sql.
--
-- La vía económica, que el mapa por sí solo no cubre: organizaciones e iniciativas a las
-- que alguien puede aportar dinero o especie, con los datos para hacerlo (transferencia,
-- pago móvil, enlace de donación) y su red social para verificarlas.
--
-- Va en su propia tabla y NO en `locations` a propósito: una organización que recibe
-- aportes no es un lugar al que se va, y ponerla en el mapa mandaría gente a la puerta de
-- una oficina en vez de a un punto de ayuda.
--
-- Mismo modelo de acceso que los puntos: lee cualquiera, escribe el equipo, borra solo un
-- admin. Sin semillas: qué organizaciones aparecen es una decisión de cada país y
-- publicar una lista de otro país sería peor que no publicar ninguna.
--
-- Idempotente.

create table if not exists public.donations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- Una línea. Qué hace, no su historia.
  description text,
  -- Red social o web: es lo que permite a quien va a donar comprobar que existe.
  social_url  text,
  -- Enlace de donación → el botón "Donar".
  donate_url  text,
  -- Datos para recibir aportes en texto libre (cuenta, pago móvil, Zelle…). Texto y no
  -- columnas porque cambia por país y por organización, y se muestra con un botón de
  -- copiar: quien dona lo pega tal cual en su banco.
  donate_info text,
  sort        int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists donations_active_idx on public.donations (sort, name) where active;

alter table public.donations enable row level security;

-- Lectura pública: solo las activas. Desactivar es la forma de retirar una organización
-- sin perder su historia.
drop policy if exists donations_public_read on public.donations;
create policy donations_public_read on public.donations
  for select to anon, authenticated using (active);

-- El equipo ve todas, incluidas las desactivadas, para poder reactivarlas.
drop policy if exists donations_staff_read on public.donations;
create policy donations_staff_read on public.donations
  for select to authenticated using (public.is_staff());

drop policy if exists donations_staff_insert on public.donations;
create policy donations_staff_insert on public.donations
  for insert to authenticated with check (public.is_staff());

drop policy if exists donations_staff_update on public.donations;
create policy donations_staff_update on public.donations
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- Borrar sigue siendo de admin, como en el mapa.
drop policy if exists donations_admin_delete on public.donations;
create policy donations_admin_delete on public.donations
  for delete to authenticated using (public.is_admin());

-- Bitácora: publicar a nombre de quién se reciben donaciones es exactamente el tipo de
-- cambio que hay que poder auditar después. `audit_row()` viene de 004.
-- ⚠️ Si ya corriste 004 antes de que existiera este archivo, vuelve a correrlo: allí se
-- añadió el nombre de la organización al resumen que se ve en «Novedades». Es idempotente.
drop trigger if exists trg_audit_donations on public.donations;
create trigger trg_audit_donations after insert or update or delete on public.donations
  for each row execute function public.audit_row();


-- ###########################################################################
-- ### 006_audit_scope
-- ###########################################################################

-- HelpMaps · alcance de la bitácora por rol — corre esto DESPUÉS de 005_donations.sql.
--
-- PROBLEMA QUE ARREGLA
--
-- `audit_log_staff_read` (004) decía `using (public.is_staff())`: cualquiera con acceso
-- al panel leía TODA la bitácora. Un voluntario veía las filas de `volunteer_requests`
-- —quién más pidió entrar al equipo, cuándo, y qué admin lo revisó— que son datos de
-- OTRAS personas y de la operación interna, no del mapa.
--
-- No era solo cosmético: la bitácora se lee con la sesión del propio usuario contra
-- PostgREST, así que esconder la pestaña en la interfaz no habría cerrado nada. Quien
-- supiera pedirlo lo pedía igual. La regla tiene que estar aquí.
--
-- REGLA
--
--   admin      → todo. Es su trabajo: revisar accesos, sugerencias y errores.
--   voluntario → solo lo que cambió EN EL MAPA (`locations`, `center_info`), que es lo
--                que necesita para no pisar el trabajo de otro ni repetirlo.
--
-- `donations` queda fuera del alcance del voluntario a propósito: es el directorio de
-- organizaciones aliadas, no un punto de ayuda al que se manda gente. Si un despliegue
-- decide que sus voluntarios también lo mantienen, añádelo a la lista de abajo.
--
-- Idempotente.

-- Las entidades que un voluntario puede ver en la bitácora. Función, no literal repetido
-- en la política, para que cambiar el alcance sea una línea y no una reescritura.
create or replace function public.audit_entity_visible_to_staff(p_entity text)
returns boolean
language sql
immutable
as $$
  select p_entity in ('locations', 'center_info');
$$;

drop policy if exists audit_log_staff_read on public.audit_log;
create policy audit_log_staff_read on public.audit_log
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_staff() and public.audit_entity_visible_to_staff(entity))
  );

-- La bitácora sigue siendo append-only: no hay política de insert/update/delete para
-- nadie, y la única escritura posible es el trigger `security definer` de 004.


-- ###########################################################################
-- ### 007_emergencies
-- ###########################################################################

-- HelpMaps · emergencias (7 de 8) — corre esto DESPUÉS de 006_audit_scope.sql.
--
-- Idempotente: se puede volver a correr sin romper nada.
--
-- ---------------------------------------------------------------------------
-- Por qué existe esta tabla
--
-- Hoy el país se resuelve en tiempo de build: `NEXT_PUBLIC_COUNTRY` elige un preset de
-- `config/presets/`, el kit se ensambla y `SITE` queda congelado dentro del bundle. Es
-- correcto para lo que resuelve, pero deja tres cosas fuera de alcance:
--
--   • levantar un país nuevo exige crear proyecto, base, variables y subdominio a mano;
--   • no hay ningún lugar desde donde ver más de una emergencia a la vez;
--   • un mismo país no puede tener dos emergencias distintas (un terremoto este año y
--     una inundación el próximo) sin sobrescribir el preset y perder la anterior.
--
-- Esta tabla es EL MISMO objeto `CountryConfig` que ya define `src/config/types.ts`,
-- guardado como fila y resuelto por host en cada request. No hay traducción de por
-- medio: un preset existente se convierte en una fila campo por campo.
--
-- ---------------------------------------------------------------------------
-- Compatibilidad hacia atrás — esto es lo que hace que la migración sea segura
--
-- Con la tabla VACÍA, la aplicación cae al preset compilado exactamente como hoy. Un
-- despliegue con `NEXT_PUBLIC_COUNTRY=co` y cero filas aquí se comporta igual que antes
-- de esta migración, línea por línea. La tabla solo empieza a mandar cuando alguien
-- inserta la primera fila.
-- ---------------------------------------------------------------------------

create table if not exists public.emergencies (
  id            uuid primary key default gen_random_uuid(),

  -- Identidad. `slug` es el id corto (namespace de caché, nombre de preset equivalente);
  -- `host` es cómo se resuelve esta fila en cada request. Sin host, la fila existe pero
  -- no la sirve ningún dominio: así se prepara una emergencia antes de anunciarla.
  slug          text not null unique,
  host          text unique,

  country_code  text not null,                       -- ISO 3166-1 alpha-2, mayúsculas
  -- Dos nombres distintos y los dos hacen falta: `country_name` es el país que rellena
  -- `CountryConfig.name` ("Venezuela", el que aparece en la marca y los metadatos), y
  -- `name` es el evento ("Terremoto de Venezuela 2026"), que es lo que administra el
  -- panel y lo que distingue dos emergencias del mismo país.
  country_name  text not null,
  name          text not null,

  -- Qué clase de evento es. No es decorativo: decide qué capas de amenaza tienen
  -- sentido ofrecer y qué vocabulario usa la interfaz.
  hazard_type   text not null default 'earthquake'
                  check (hazard_type in
                    ('earthquake','flood','storm','fire','landslide','conflict','other')),

  -- draft    — existe, se puede preparar, no la sirve ningún host todavía.
  -- active   — en vivo.
  -- archived — pasó. Se sigue pudiendo consultar, no se sigue editando.
  status        text not null default 'draft'
                  check (status in ('draft','active','archived')),

  -- ── El kit de configuración, con la forma que ya definen los tipos ──────────
  -- Cada uno de estos jsonb corresponde a un campo de `CountryConfig`. La validación
  -- de forma sigue viviendo en `src/config/validate.ts`, que ahora corre también sobre
  -- lo que sale de aquí: una fila mal armada falla igual que un preset mal armado.
  region_noun   jsonb not null default '{"one":"región","many":"regiones"}'::jsonb,
  geo           jsonb not null,                      -- center, zoom, regionZoom, bounds, geocodeCountry
  regions       jsonb not null default '[]'::jsonb,  -- [{ code, name, lat, lng, zoom }]
  legal         jsonb not null,                      -- controller, privacyEmail, dataLaw, jurisdiction
  brand         jsonb not null default '{}'::jsonb,  -- BrandOverrides
  features      jsonb not null default '{}'::jsonb,  -- Partial<FeatureConfig>
  language      jsonb not null default '{}'::jsonb,  -- LanguageOverrides
  hazard        jsonb not null default '{}'::jsonb,  -- HazardConfig (sísmica USGS)

  -- Capas extra de ESTA emergencia: [{ id, label, kind, url, attribution, defaultOn }].
  -- Las capas que aporta AcopioVE (daño satelital SAR, edificios dañados en 3D, lluvia,
  -- clima, alertas) son específicas de un evento concreto, no de un país: el snapshot de
  -- edificios de Catia La Mar no significa nada en una inundación en otro sitio. Por eso
  -- se declaran por emergencia en vez de compilarse como componentes fijos.
  layers        jsonb not null default '[]'::jsonb,

  -- ── Estado operativo de la emergencia ──────────────────────────────────────
  -- `app_settings` sigue siendo el interruptor de TODA la instalación y no se toca.
  -- Esto es lo mismo pero de UNA emergencia: cuando el equipo de un país baja sus datos
  -- para reverificarlos, su mapa queda vacío a propósito y necesita decirlo, sin apagar
  -- los mapas de los demás países.
  maintenance   boolean not null default false,
  notice        text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Para una tabla creada antes de que existiera `country_name`: la añade sin tocar el
-- resto. `create table if not exists` no altera una tabla que ya está.
alter table public.emergencies add column if not exists country_name text;
update public.emergencies set country_name = name where country_name is null;
alter table public.emergencies alter column country_name set not null;

-- El host es la consulta caliente: se resuelve en cada request antes de servir nada.
-- La unicidad ya crea el índice; este parcial cubre el listado del hub.
create index if not exists emergencies_status_idx on public.emergencies (status)
  where status <> 'draft';

drop trigger if exists trg_emergencies_touch on public.emergencies;
create trigger trg_emergencies_touch before update on public.emergencies
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Lectura pública de lo que no es borrador: es la configuración del sitio (nombre,
-- colores, regiones, encuadre) más el aviso legal, todo lo cual ya viaja hoy dentro del
-- bundle que descarga cualquiera. Los borradores no se publican: preparar una emergencia
-- no debería anunciarla.
--
-- Las políticas de ESCRITURA se definen en 008_tenancy.sql, porque dependen de
-- `is_superadmin()`, que se crea allí. Entre una migración y la otra la tabla queda con
-- RLS activo y sin política de escritura, es decir: nadie escribe. Ese es el lado
-- correcto en el que quedarse a medio camino.
-- ---------------------------------------------------------------------------
alter table public.emergencies enable row level security;

drop policy if exists emergencies_public_read on public.emergencies;
create policy emergencies_public_read on public.emergencies
  for select to anon, authenticated using (status <> 'draft');

drop policy if exists emergencies_staff_read on public.emergencies;
create policy emergencies_staff_read on public.emergencies
  for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Verificación: emergencias activas sin host asignado (no las sirve nadie).
--   select slug, name, status, host from public.emergencies order by status, slug;
-- ---------------------------------------------------------------------------


-- ###########################################################################
-- ### 008_tenancy
-- ###########################################################################

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
-- Corré `db/03_verificacion.sql` al terminar.
-- ===========================================================================


-- ###########################################################################
-- ### 009_news
-- ###########################################################################

-- HelpMaps · boletín de prensa (9 de 9) — corre esto DESPUÉS de 008_tenancy.sql.
--
-- Idempotente.
--
-- ---------------------------------------------------------------------------
-- Qué resuelve
--
-- AcopioVE publica un boletín: agrega titulares de una docena de medios, descarta lo que
-- no habla de la emergencia y sintetiza el resto. Es lo primero que abre mucha gente que
-- no está buscando un refugio sino entendiendo qué está pasando.
--
-- Al traerlo hay que cambiarle dos cosas, y las dos por el mismo motivo — que ahí estaba
-- escrito para un país concreto:
--
--   • Los MEDIOS eran una lista fija en el código. Ahora los declara cada emergencia:
--     los diarios que cubren una inundación en otro país no son los mismos.
--   • El FILTRO DE RELEVANCIA cruzaba dos listas de palabras, una de emergencia
--     ("sismo", "réplica", "epicentro") y otra de lugares venezolanos. También se declaran
--     por emergencia: sin eso, un despliegue nuevo filtra por los estados de Venezuela.
--
-- Y una tercera, que es de infraestructura: la caché vivía en DISCO. Eso funciona en un
-- servidor de larga vida y no funciona en el despliegue de HelpMaps, donde el disco es
-- efímero y cada instancia tendría su propio boletín. Va a la base.
-- ---------------------------------------------------------------------------

-- Configuración del boletín, por emergencia.
--
--   {
--     "feeds":    [{ "id": "efectococuyo", "name": "Efecto Cocuyo", "url": "https://..." }],
--     "keywords": { "emergency": ["sismo", "réplica"], "place": ["caracas", "la guaira"] },
--     "refreshHours": 4
--   }
--
-- Vacío significa apagado: sin medios declarados no hay boletín, y la portada no muestra
-- una sección vacía donde debería haber noticias.
alter table public.emergencies add column if not exists news jsonb not null default '{}'::jsonb;


-- ---------------------------------------------------------------------------
-- Boletines generados.
--
-- Histórico, no una sola fila que se pisa. Dos razones: la portada ofrece navegar los
-- anteriores —lo que pasó ayer sigue importando cuando llevás tres días sin señal— y
-- porque un boletín es lo que una IA dijo en un momento dado sobre una emergencia real:
-- si alguna vez hay que revisar qué se publicó y cuándo, tiene que estar.
-- ---------------------------------------------------------------------------
create table if not exists public.news_bulletins (
  id            uuid primary key default gen_random_uuid(),
  emergency_id  uuid not null references public.emergencies(id) on delete cascade,
  generated_at  timestamptz not null default now(),
  summary       text not null,
  -- Qué medios entraron en ESTA corrida: si uno se cayó, el boletín no lo dice solo.
  sources       jsonb not null default '[]'::jsonb,
  -- El modelo que lo escribió. Un cambio de modelo cambia el tono y conviene poder verlo.
  model         text,
  created_at    timestamptz not null default now()
);

create index if not exists news_bulletins_emergency_idx
  on public.news_bulletins (emergency_id, generated_at desc);

alter table public.news_bulletins enable row level security;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Lectura pública: el boletín es contenido publicado, igual que el mapa.
--
-- Escritura: NINGUNA política, para nadie. Generar un boletín cuesta dinero —es una
-- llamada a un modelo de pago— y no puede dispararla un navegador. La única escritura
-- posible es la ruta de generación, con la clave de servicio y detrás de un secreto de
-- cron, igual que en AcopioVE. Sin política, la anon key no puede insertar ni aunque
-- alguien encuentre el endpoint.
-- ---------------------------------------------------------------------------
drop policy if exists news_bulletins_public_read on public.news_bulletins;
create policy news_bulletins_public_read on public.news_bulletins
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Verificación: último boletín de cada emergencia.
--   select e.slug, b.generated_at, left(b.summary, 80)
--   from public.emergencies e
--   left join lateral (
--     select * from public.news_bulletins n
--     where n.emergency_id = e.id order by n.generated_at desc limit 1
--   ) b on true;
-- ---------------------------------------------------------------------------


-- ###########################################################################
-- ### 010_accounts
-- ###########################################################################

-- HelpMaps · cuentas de persona (10 de 10) — corre esto DESPUÉS de 009_news.sql.
--
-- Idempotente.
--
-- ---------------------------------------------------------------------------
-- Qué cambia y por qué
--
-- Hasta acá una cuenta existía sólo si un admin la creaba: el equipo, y nadie más. Eso
-- mantenía la base sin un solo dato de alguien de fuera del equipo, que es la forma más
-- barata de proteger a la gente — lo que no se guarda no se filtra.
--
-- A partir de acá cualquiera puede tener cuenta. Es un aumento real de la superficie de
-- datos personales, en un mapa de emergencia venezolano cuyo aviso legal cita la LOPNNA,
-- así que el esquema tiene que ganarse cada columna que agrega. Las reglas que sigue:
--
--   • El CORREO no se copia acá. Vive donde ya vivía, en `auth.users`, al que sólo se
--     llega con el service role y detrás de `requireAdmin()`. Ninguna política de este
--     archivo lo expone, y por eso un voluntario mirando el panel ve "Ana M." y no la
--     dirección de Ana. Esa es la línea de privacidad real: no es admin contra público,
--     es admin contra TODO EL RESTO, voluntarios incluidos.
--
--   • Lo que sí se guarda acá es lo mínimo para distinguir a una persona de otra en una
--     cola de revisión: un nombre para mostrar.
--
--   • Lo que revela por dónde se mueve alguien —qué refugios guardó— no lo ve NADIE más
--     que su dueño. Ni los admins. Operar el mapa no necesita ese dato, y una lista de
--     refugios guardados es un mapa de los movimientos de una persona.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- 1) profiles — quién es cada cuenta, sin decir su correo
-- ===========================================================================

create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  -- Lo ÚNICO que otra persona del equipo llega a ver. No se valida como nombre real a
  -- propósito: quien prefiera un apodo tiene que poder usarlo, y en este país esa
  -- preferencia puede no ser un capricho.
  display_name text not null check (length(trim(display_name)) between 2 and 40),
  -- Opcional, y sólo hasta el nivel de estado: sirve para que un admin sepa a qué zona
  -- corresponde una postulación sin pedirle a nadie una dirección.
  region       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- El equipo ve el NOMBRE de quien postuló o reportó algo, para poder hablar de una
-- persona concreta en la cola. Nada más: el correo no está en esta tabla.
drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_staff_read on public.profiles
  for select to authenticated using (public.is_staff());

-- Sin política de DELETE para nadie: una cuenta se borra en `auth.users` y el
-- `on delete cascade` se lleva esta fila. Borrar el perfil dejando la cuenta produce una
-- persona sin nombre en las colas, que es peor que no poder borrarlo.


-- ===========================================================================
-- 2) favourites — los puntos que alguien guardó
--
-- Privado de verdad: la política es `user_id = auth.uid()` y NO tiene excepción para
-- admins. Es la única tabla del proyecto de la que un superadmin no puede leer nada, y es
-- deliberado: saber qué refugios guardó una persona es saber dónde piensa ir o dónde
-- estuvo, y ninguna tarea de operar el mapa necesita ese dato.
-- ===========================================================================

create table if not exists public.favourites (
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- `text`, no `uuid`: `locations.id` es text desde `001_core.sql` porque conserva el
  -- identificador con el que cada punto llegó de su fuente (AcopioVE, RefugioVE, las
  -- hojas de las brigadas). Un uuid acá revienta la clave foránea al crearla.
  location_id text not null references public.locations(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, location_id)
);

create index if not exists favourites_user_idx on public.favourites (user_id, created_at desc);

alter table public.favourites enable row level security;

drop policy if exists favourites_own on public.favourites;
create policy favourites_own on public.favourites
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));


-- ===========================================================================
-- 3) Atar lo que ya existe a una cuenta, SIN romper el camino anónimo
--
-- Las dos columnas son NULL-ables y ese null es la función, no un descuido: significa
-- "lo mandó alguien sin cuenta", que sigue siendo un camino de primera clase. En una
-- emergencia, con un minuto y una barra de señal, exigir registro para avisar de un
-- refugio pierde el aviso.
-- ===========================================================================

alter table public.submissions
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.volunteer_requests
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists submissions_mine_idx
  on public.submissions (created_by, created_at desc) where created_by is not null;

-- Una cuenta, una postulación viva. Sin esto, alguien impaciente manda cinco y un admin
-- revisa cinco veces a la misma persona. El índice es parcial sobre 'pending' a
-- propósito: deja volver a postularse después de un rechazo, que es lo que corresponde
-- —rechazado hoy no es rechazado para siempre— y no estorba al camino anónimo, donde
-- `user_id` es null y un índice único ignora los nulos.
create unique index if not exists volunteer_requests_one_pending_per_user
  on public.volunteer_requests (user_id) where user_id is not null and status = 'pending';

-- Quien mandó algo puede ver QUÉ pasó con lo suyo. Es la razón principal por la que
-- alguien se haría una cuenta acá: hoy una sugerencia anónima cae en un pozo sin fondo.
-- Sólo las propias, y sólo leer.
drop policy if exists submissions_own_read on public.submissions;
create policy submissions_own_read on public.submissions
  for select to authenticated using (created_by = (select auth.uid()));

drop policy if exists volunteer_requests_own_read on public.volunteer_requests;
create policy volunteer_requests_own_read on public.volunteer_requests
  for select to authenticated using (user_id = (select auth.uid()));


-- ===========================================================================
-- 4) point_reports — "esto sigue abierto", dicho por alguien que no es del equipo
--
-- POR QUÉ NO ESCRIBE DIRECTO SOBRE `center_info`
--
-- La tentación es obvia: hay cientos de centros sin confirmar hace más de un mes, y dejar
-- que cualquiera con cuenta toque `last_confirmed_at` los pondría al día en una tarde.
--
-- Y es exactamente el fallo contra el que este repo avisa en cada archivo. El modelo de
-- confianza de `002_staff.sql` dice que un voluntario es gente VERIFICADA, y que lo que
-- la frena no es una revisión previa sino que su acceso es revocable al instante. Una
-- cuenta con un correo confirmado no es gente verificada: es un correo. Si eso puede
-- marcar "abierto" un refugio cerrado, el mapa manda a una familia a una puerta que no
-- existe — y con el sello de recién confirmado encima, que es justo lo que hace que le
-- crean.
--
-- Así que un reporte es una SEÑAL, no una escritura. Llega al panel, y un admin que ve
-- "3 personas dicen que sigue abierto" confirma de un clic. El trabajo del admin baja
-- muchísimo; el permiso de escritura no se mueve de donde estaba.
-- ===========================================================================

create table if not exists public.point_reports (
  id          uuid primary key default gen_random_uuid(),
  -- `text` por lo mismo que en `favourites`: ver la nota de arriba.
  location_id text not null references public.locations(id) on delete cascade,
  -- A qué emergencia pertenece. Se copia del punto con el trigger de abajo en vez de
  -- pedirla a quien reporta: el navegador no tiene por qué saberla, y si la mandara
  -- podría mentir y colar un reporte en la cola de otra emergencia.
  emergency_id uuid references public.emergencies(id) on delete cascade,
  -- Quién lo dijo. NOT NULL: un reporte anónimo no se puede sopesar ni volver a
  -- preguntar, y una cola de reportes anónimos es una cola de ruido.
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('sigue_abierto','ya_cerro','dato_incorrecto')),
  note        text check (note is null or length(note) <= 500),
  status      text not null default 'pending'
                check (status in ('pending','applied','dismissed')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists point_reports_pending_idx
  on public.point_reports (location_id, created_at desc) where status = 'pending';

-- Un reporte por persona y punto mientras siga pendiente: sin esto, cinco toques del
-- mismo dedo se ven en el panel como cinco personas de acuerdo.
create unique index if not exists point_reports_one_pending_per_user
  on public.point_reports (user_id, location_id) where status = 'pending';

alter table public.point_reports enable row level security;

-- Crear: cualquiera con sesión, sólo en su propio nombre y en estado 'pending'.
drop policy if exists point_reports_insert on public.point_reports;
create policy point_reports_insert on public.point_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

-- Leer: lo propio siempre, o el del equipo QUE ALCANZA ESA EMERGENCIA.
--
-- `can_edit(emergency_id)` y no `is_staff()`: desde `008_tenancy.sql` el permiso de este
-- proyecto no es "sos del equipo" sino "sos del equipo Y esta emergencia es tuya". Con
-- `is_staff()` suelto, un voluntario de una emergencia leería la cola de otra en un
-- despliegue conjunto — que es exactamente lo que 008 se puso a arreglar.
drop policy if exists point_reports_read on public.point_reports;
create policy point_reports_read on public.point_reports
  for select to authenticated
  using (user_id = (select auth.uid()) or public.can_edit(emergency_id));

-- Resolver: el equipo de esa emergencia.
drop policy if exists point_reports_staff_update on public.point_reports;
create policy point_reports_staff_update on public.point_reports
  for update to authenticated
  using (public.can_edit(emergency_id)) with check (public.can_edit(emergency_id));

-- Mismo guardia que `volunteer_requests`: que nadie resuelva sus propios reportes
-- cambiando el `status` por su cuenta. La política de arriba ya lo impide para quien no
-- es del equipo; esto cubre el caso de un voluntario resolviendo el suyo.
create or replace function public.guard_point_report_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $guard$
begin
  if new.status is distinct from old.status then
    if not public.is_staff() then
      raise exception 'Sólo el equipo puede resolver un reporte.';
    end if;
    new.reviewed_at := now();
    new.reviewed_by := auth.uid();
  end if;
  return new;
end
$guard$;

-- De dónde sale `emergency_id`: del PUNTO, no de quien reporta.
--
-- El navegador no tiene por qué conocerla, y si la mandara podría mentir — colar un
-- reporte en la cola de otra emergencia, o ponerla en null para escaparse del alcance de
-- `can_edit()`. Copiarla acá la vuelve un dato derivado y no una entrada.
create or replace function public.set_point_report_emergency()
returns trigger
language plpgsql
security definer
set search_path = public
as $scope$
begin
  select l.emergency_id into new.emergency_id
    from public.locations l where l.id = new.location_id;
  return new;
end
$scope$;

drop trigger if exists point_reports_scope_trg on public.point_reports;
create trigger point_reports_scope_trg before insert on public.point_reports
  for each row execute function public.set_point_report_emergency();

drop trigger if exists point_reports_guard_trg on public.point_reports;
create trigger point_reports_guard_trg before update on public.point_reports
  for each row execute function public.guard_point_report_status();


-- ===========================================================================
-- 5) Cuántos reportes sin resolver tiene cada punto
--
-- Vista y no consulta suelta: el panel la pide en cada carga, y es la que ordena la cola
-- por "dónde hay más gente diciendo lo mismo".
--
-- `security_invoker` para que la vista NO sea un agujero alrededor de la RLS de
-- `point_reports`: se evalúa con los permisos de quien consulta, así que alguien de fuera
-- del equipo no ve los reportes de los demás por esta puerta.
-- ===========================================================================

create or replace view public.point_report_counts
with (security_invoker = true) as
  select location_id,
         count(*) filter (where kind = 'sigue_abierto')   as sigue_abierto,
         count(*) filter (where kind = 'ya_cerro')        as ya_cerro,
         count(*) filter (where kind = 'dato_incorrecto') as dato_incorrecto,
         max(created_at)                                  as ultimo
    from public.point_reports
   where status = 'pending'
   group by location_id;


-- ===========================================================================
-- 6) `updated_at` al día en profiles
--
-- Reutiliza `public.touch_updated_at()` de `001_core.sql`. NO la redefine, y esa
-- contención es el punto: esa función no es un `new.updated_at := now()` ingenuo. Salta
-- el toque cuando la fila no cambió en nada más que la propia marca de tiempo,
-- precisamente para que un pipeline que reescribe todo cada cinco minutos no deje
-- "actualizado hace un minuto" en cientos de puntos que nadie confirmó hace semanas.
--
-- Un `create or replace` acá con la versión obvia de tres líneas se lleva puesto ese
-- comportamiento en `locations`, `center_info`, `emergencies` y `emergency_phones`, que
-- son las otras cuatro tablas que la usan — sin error, sin aviso, y estropeando justo la
-- fecha con la que una familia decide si vale la pena el viaje.
-- ===========================================================================

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------------
-- Verificación — y corré db/03_verificacion.sql después de esto.
--
--   select tablename, rowsecurity from pg_tables
--    where schemaname = 'public'
--      and tablename in ('profiles','favourites','point_reports');   -- las tres en true
--
--   select count(*) from public.profiles;
-- ---------------------------------------------------------------------------


-- ###########################################################################
-- ### 011_digitales
-- ###########################################################################
-- Iniciativas sin sede física. Copia literal de db/04_digitales.sql, que es el mismo
-- bloque para aplicar encima de una base que ya corrió este archivo antes de que
-- existiera la sección. Si cambias uno, cambia el otro.
--
-- Hasta aquí todo `locations` era un sitio al que ir: lat/lng obligatorios. Las
-- iniciativas `digital` no tienen local; declaran las regiones y municipios donde prestan
-- ayuda y la app las dibuja en el centroide de cada región como marcador de cobertura,
-- no como pin. Lista vacía = todo el país.
-- ===========================================================================

alter table public.locations drop constraint if exists locations_type_check;
alter table public.locations add constraint locations_type_check
  check (type in ('shelter','donation_centre','comedor','iniciativa','hospital','morgue','digital'));

-- Coordenadas opcionales SOLO para `digital`.
alter table public.locations alter column lat drop not null;
alter table public.locations alter column lng drop not null;
alter table public.locations drop constraint if exists locations_coords_required;
alter table public.locations add constraint locations_coords_required
  check (type = 'digital' or (lat is not null and lng is not null));

alter table public.locations
  add column if not exists coverage_regions text[] not null default '{}';
alter table public.locations
  add column if not exists coverage_municipalities text[] not null default '{}';

create index if not exists locations_coverage_regions_idx
  on public.locations using gin (coverage_regions) where type = 'digital';

alter table public.center_info add column if not exists website text;
alter table public.center_info add column if not exists instagram text;
