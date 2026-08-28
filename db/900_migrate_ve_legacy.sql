-- ===========================================================================
-- db/900_migrate_ve_legacy.sql — la base heredada de Venezuela → el esquema base
-- ---------------------------------------------------------------------------
-- CORRE ESTE ARCHIVO PRIMERO, y DESPUÉS `db/01_esquema.sql`. El esquema usa
-- `create table if not exists`: al encontrar las tablas ya renombradas se salta la
-- creación y sólo añade índices, triggers, funciones y políticas.
--
-- ⚠️ HISTÓRICO. La base heredada de Venezuela ya se migró y este archivo no se ha vuelto
-- a usar. Se conserva por si otro despliegue viene de una base con el esquema viejo.
--
-- QUÉ ARREGLA
-- El repo base consulta `locations.id` y `center_info`. La base de helpmapvzla.net
-- tiene `locations.location_id` y `refugios`, así que la PRIMERA consulta del mapa
-- devuelve 400 (42703, "column locations.id does not exist"), `useCenters` la atrapa
-- y pinta cero puntos. Los datos siempre estuvieron ahí: 520 locations activas y
-- 476 filas de necesidades. Esto los renombra en sitio — no copia, no reimporta,
-- no toca un solo valor de los que la gente confirmó.
--
-- ⚠️ CORTE: al terminar, la app vieja (helpmapvzla.net, repo helpmap-venezuela)
-- DEJA DE FUNCIONAR — consulta `location_id`, `canonical_name`, `refugios` y
-- `admin_users`, que después de esto no existen. Redirige el dominio al despliegue
-- nuevo en la misma ventana.
--
-- El editor SQL de Supabase corre el archivo entero en UNA transacción: si algo
-- falla no queda nada a medias. No hay ALTER TYPE ... ADD VALUE aquí, así que no
-- hace falta el baile de correr trozos por separado que pedían los archivos viejos.
--
-- Idempotente en lo que puede serlo. Correrlo dos veces falla en la guarda de abajo,
-- que es lo correcto: la segunda vez no hay nada que migrar.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0. Guarda: que esto no corra sobre la base equivocada.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.refugios') is null then
    raise exception
      'No existe public.refugios: o esta no es la base heredada de Venezuela, o la migración ya corrió.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Triggers y funciones viejas que estorban.
--
-- `audit_row()` lo redefine 004 para escribir en `entity` (la columna que abajo
-- renombramos). Los triggers viejos apuntan a esa misma función y quedarían
-- duplicando cada fila del log junto a los `trg_audit_*` que crea 004.
-- ---------------------------------------------------------------------------
drop trigger if exists audit_locations       on public.locations;
drop trigger if exists audit_volunteer_reqs  on public.volunteer_requests;
drop trigger if exists volunteer_requests_guard_trg on public.volunteer_requests;
drop function if exists public.volunteer_requests_guard() cascade;

-- Y las políticas RLS, aquí y no al final: Postgres se niega a cambiar el tipo de
-- una columna citada en una política ("cannot alter type of a column used in a
-- policy definition"), y abajo `type` y `state` pasan de enum a text. Borrarlas
-- primero también es lo correcto por seguridad — quedaron escritas contra nombres
-- de tabla y roles que después de este archivo ya no existen, y una política
-- permisiva de más sobrevive callada. Con la app escribiendo directo con la anon
-- key, RLS es lo único que separa "cualquiera lee los refugios" de "cualquiera los
-- edita". 001…006 las recrean completas: correr esos archivos después NO es
-- opcional, y entre este archivo y 002 nadie lee nada (RLS activo, cero políticas).
do $$
declare p record;
begin
  for p in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('locations','refugios','app_settings','admin_users',
                         'volunteer_requests','audit_log','donations')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. `address` vive en el sitio equivocado.
--
-- En el esquema viejo la dirección cuelga de `refugios`; en el base es un dato de
-- la ubicación, no de las necesidades. Se mueve ANTES de renombrar nada: 430 de
-- las 476 filas la tienen y se perderían al borrar la columna.
-- ---------------------------------------------------------------------------
alter table public.locations add column if not exists address text;

update public.locations l
   set address = r.address
  from public.refugios r
 where r.location_id = l.location_id
   and r.address is not null
   and l.address is null;

-- ---------------------------------------------------------------------------
-- 3. locations — los nombres que el repo base consulta.
--
-- `type` y `state` son ENUMs de Postgres. El esquema base los quiere TEXT a
-- propósito (ver la cabecera de 001): con un enum, añadir una región exigía un
-- ALTER TYPE en su propia transacción antes de poder insertar una sola fila, y eso
-- en plena emergencia es un bloqueo. Las 21 regiones con datos coinciden una a una
-- con los `code` del preset de Venezuela, así que el cast no pierde ninguna.
-- ---------------------------------------------------------------------------
alter table public.locations rename column location_id       to id;
alter table public.locations rename column canonical_name    to name;
alter table public.locations rename column state             to region;
alter table public.locations rename column contact_phone     to phone;
alter table public.locations rename column contact_whatsapp  to whatsapp;

-- El default es `'hospital'::location_type`: Postgres no puede castearlo solo al
-- cambiar el tipo, así que se quita antes. El esquema base no repone default —
-- el tipo de un punto es una decisión, no algo que se herede por descuido.
alter table public.locations alter column "type" drop default;
alter table public.locations alter column "type" type text using "type"::text;

-- `state` era NOT NULL; `region` es opcional en el base (CenterDraft.region admite
-- null) y el panel de staff puede guardar un punto antes de saber su región.
alter table public.locations alter column region type text using region::text;
alter table public.locations alter column region drop not null;

alter table public.locations drop constraint if exists locations_type_check;
alter table public.locations add constraint locations_type_check
  check ("type" in ('shelter','donation_centre','comedor','iniciativa','hospital','morgue'));

-- `updated_at` no existía. Se rellena con `created_at`, no con now(): poner la hora
-- de la migración diría "actualizado hace un minuto" en 520 puntos que nadie
-- confirmó, y esa fecha es justo la que una familia usa para decidir si vale la
-- pena el viaje. Para los 476 puntos con necesidades este campo casi nunca se lee
-- —`lastTouched()` prefiere `center_info.last_confirmed_at`— pero para los 44 sin
-- fila en `center_info` es el único dato de frescura que hay.
alter table public.locations add column if not exists updated_at timestamptz;
update public.locations set updated_at = created_at where updated_at is null;
alter table public.locations alter column updated_at set not null;
alter table public.locations alter column updated_at set default now();

-- ---------------------------------------------------------------------------
-- 4. refugios → center_info.
--
-- Misma tabla, mismas filas, mismos IDs: solo cambia el idioma de las columnas.
-- Renombrar preserva índices, el UNIQUE de external_id (467 filas lo usan para
-- casar con las fuentes de origen) y los permisos.
-- ---------------------------------------------------------------------------
alter table public.refugios rename to center_info;

alter table public.center_info rename column recibe      to receives;
alter table public.center_info rename column necesita    to needs;
alter table public.center_info rename column horario     to schedule;
alter table public.center_info rename column responsable to contact_name;
alter table public.center_info rename column fuente      to source;
alter table public.center_info rename column es_animal   to is_animal;
alter table public.center_info rename column categoria   to category;
alter table public.center_info rename column descripcion to description;
alter table public.center_info rename column ayuda       to help;
alter table public.center_info rename column estado      to status;

-- Ya copiada a `locations` en el paso 2.
alter table public.center_info drop column if exists address;

alter table public.center_info drop constraint if exists refugios_estado_chk;
alter table public.center_info add constraint center_info_status_check
  check (status is null or status in ('abierto','lleno','cerrado'));

alter table public.center_info drop constraint if exists refugios_ayuda_keys;
alter table public.center_info add constraint center_info_help_keys
  check (help <@ array['voluntariado','especie','oficios','difusion','economico']::text[]);

-- La FK vieja no cascadea. `deleteCenter()` borra solo de `locations` y cuenta con
-- que las necesidades se vayan detrás; sin CASCADE ese borrado falla por la FK.
alter table public.center_info drop constraint if exists refugios_location_id_fkey;
alter table public.center_info add constraint center_info_location_id_fkey
  foreign key (location_id) references public.locations(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 5. app_settings — la fila única pasa de id=1 (integer) a id=true (boolean).
--
-- `fetchSettings()` filtra por `.eq("id", true)`. Contra la columna integer eso
-- es un error que la función se traga devolviendo los valores por defecto: hoy el
-- aviso global y el modo mantenimiento están mudos aunque la fila exista.
-- ---------------------------------------------------------------------------
alter table public.app_settings add column if not exists notice text;
alter table public.app_settings drop constraint if exists app_settings_id_check;
alter table public.app_settings alter column id drop default;
alter table public.app_settings alter column id type boolean using (id = 1);
alter table public.app_settings alter column id set default true;
alter table public.app_settings add constraint app_settings_id_check check (id);

-- ---------------------------------------------------------------------------
-- 6. admin_users → staff_users.
--
-- `is_staff()` e `is_admin()` los redefine 002 leyendo de `staff_users`. Como los
-- user_id se conservan, todas las políticas que ya llamaban a esas funciones
-- siguen dando el mismo resultado para la misma gente.
--
-- El rol 'verifier' no existe en el base (solo admin | volunteer) y baja a
-- 'volunteer': en la duda, el permiso menor.
-- ---------------------------------------------------------------------------
alter table public.admin_users rename to staff_users;

alter table public.staff_users add column if not exists email text;
update public.staff_users s
   set email = u.email
  from auth.users u
 where u.id = s.user_id
   and s.email is null;

update public.staff_users set role = 'volunteer' where role = 'verifier';

alter table public.staff_users alter column role drop default;
alter table public.staff_users drop constraint if exists admin_users_role_check;
alter table public.staff_users add constraint staff_users_role_check
  check (role in ('admin','volunteer'));

alter table public.staff_users drop constraint if exists admin_users_user_id_fkey;
alter table public.staff_users add constraint staff_users_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 7. volunteer_requests — columnas al inglés del esquema base.
-- ---------------------------------------------------------------------------
alter table public.volunteer_requests rename column nombre   to name;
alter table public.volunteer_requests rename column telefono to phone;
alter table public.volunteer_requests rename column perfil   to profile;
alter table public.volunteer_requests rename column fuentes  to motivation;
alter table public.volunteer_requests add column if not exists region text;

-- ---------------------------------------------------------------------------
-- 8. audit_log — `entity_type` es `entity` en el base.
-- ---------------------------------------------------------------------------
alter table public.audit_log rename column entity_type to entity;

-- ---------------------------------------------------------------------------
-- 9. RLS activo en todo lo migrado.
--
-- Las políticas se borraron en el paso 1 (ver el porqué allí). Esto solo garantiza
-- que ninguna tabla quede con RLS apagado, que es el estado en el que las políticas
-- de 002 no protegerían nada.
-- ---------------------------------------------------------------------------
alter table public.locations          enable row level security;
alter table public.center_info        enable row level security;
alter table public.app_settings       enable row level security;
alter table public.staff_users        enable row level security;
alter table public.volunteer_requests enable row level security;
alter table public.audit_log          enable row level security;
alter table public.donations          enable row level security;

-- ---------------------------------------------------------------------------
-- 10. Los enums que ya no usa ninguna columna.
--
-- Sin CASCADE a propósito: si algo todavía depende de ellos, esto revienta y la
-- transacción entera se deshace, que es mucho mejor que arrastrar en silencio una
-- tabla que nadie recordaba.
-- ---------------------------------------------------------------------------
drop type if exists location_type;
drop type if exists vzla_state;

-- ---------------------------------------------------------------------------
-- 11. PostgREST cachea el esquema. Sin esto sigue sirviendo los nombres viejos y
--     el mapa continúa vacío después de una migración que sí funcionó.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ===========================================================================
-- QUEDA FUERA, A PROPÓSITO
--
-- `rescatados`, `missing_reports`, `contributions`, `telegram_pending_uploads` y
-- `telegram_authorized_senders` son de la app vieja y el repo base no las consulta.
-- No se tocan: `rescatados` y `missing_reports` guardan datos de personas y
-- borrarlos es una decisión aparte, con su propia conversación. Se quedan ahí,
-- inertes, hasta que alguien decida qué hacer con ellas.
--
-- DESPUÉS DE ESTE ARCHIVO
--   1. db/01_esquema.sql § 001_core … db/01_esquema.sql § 006_audit_scope, en orden.
--   2. db/03_verificacion.sql — verifica que RLS quedó como debe.
--   3. Comprobación de regiones (final de 001): toda fila cuya `region` no esté en
--      el preset sale en el mapa pero no en el filtro.
--        select region, count(*) from public.locations group by 1 order by 2 desc;
-- ===========================================================================
