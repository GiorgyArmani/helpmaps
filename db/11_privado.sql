-- ===========================================================================
-- db/11_privado.sql — las funciones de alcance salen de la API
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `017_privado` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Un solo bloque: o se aplica todo o nada.
--
--   • En una base que ya corrió 09 y 10 (Venezuela): sólo esto.
--   • En una base con un 01_esquema.sql VIEJO, antes de correr 05…10 nuevos: esto
--     PRIMERO. Los archivos nuevos crean sus políticas llamando a `private.can_edit()` y
--     compañía, y hasta que esto corra esas funciones están en `public`.
--   • En una base nueva, nada: 01_esquema.sql ya las crea en `private`.
--
-- ---------------------------------------------------------------------------
-- QUÉ RESUELVE
--
-- El aviso 0029 del linter de Supabase sobre las ocho funciones que deciden quién es
-- quién: `is_staff`, `is_admin`, `is_superadmin`, `belongs_to`, `can_edit`,
-- `can_delete`, `manages_location` y `can_manage_location`.
--
-- `authenticated` NECESITA poder ejecutarlas: las llaman las políticas RLS, y una
-- política corre como quien consulta (ver 09_endurecimiento.sql, caso C). Pero mientras
-- vivan en `public` ese mismo permiso las convierte en `/rest/v1/rpc/can_edit`, un
-- endpoint que nadie pidió y con el que cualquiera con sesión puede ir preguntando
-- «¿alcanzo esta emergencia?, ¿y ésta?». No escriben nada; aun así, una puerta que no
-- hace falta no tiene por qué estar.
--
-- En `private` —que la API no publica— las políticas las siguen llamando igual y la
-- puerta desaparece. Es lo que la documentación de Supabase recomienda para estas
-- funciones: nunca `security definer` en un esquema expuesto.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ MOVERLAS Y NO RECREARLAS
--
-- `alter function … set schema` conserva la función —el mismo OID—, y una política
-- guarda a qué función llama por su OID, no por su nombre. Así que las más de cien
-- políticas que las usan pasan a apuntar a `private` solas, sin tocar ninguna.
--
-- Lo que SÍ guarda el nombre es el CUERPO de otra función: `can_edit` llama a
-- `public.is_staff()` escrito como texto, y `guard_submission_status` también. Ésas se
-- reescriben en el paso 2, leyendo su definición de la propia base —no de este
-- repositorio—, así que funciona también con lo que la base tenga y el repo no.
-- ===========================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

do $privado$
declare
  -- Las ocho, con su firma.
  firmas constant text[] := array[
    'is_staff()', 'is_admin()', 'is_superadmin()',
    'belongs_to(uuid)', 'can_edit(uuid)', 'can_delete(uuid)',
    'manages_location(text)', 'can_manage_location(text)'
  ];
  -- Una llamada escrita `public.<una de las ocho>(`. `\m` para no pescar un nombre que
  -- sólo termine igual.
  llamada constant text :=
    '\mpublic\.(is_staff|is_admin|is_superadmin|belongs_to|can_edit|can_delete|manages_location|can_manage_location)\(';
  f       text;
  r       record;
  v_resto text;
begin

  -- -------------------------------------------------------------------------
  -- 1) Mover las que siguen en `public`.
  -- -------------------------------------------------------------------------
  foreach f in array firmas loop
    if to_regprocedure('public.' || f) is not null
       and to_regprocedure('private.' || f) is null then
      execute format('alter function public.%s set schema private', f);
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- 2) Reescribir los cuerpos que las llaman por su nombre en `public`.
  --
  -- `create or replace` con la definición que da la base, cambiando sólo el esquema de
  -- esas llamadas. Conserva permisos, `security definer` y `search_path`.
  -- -------------------------------------------------------------------------
  for r in
    select p.oid
      from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
       and p.prokind = 'f'
       and p.prosrc ~ llamada
  loop
    execute regexp_replace(pg_get_functiondef(r.oid), llamada, 'private.\1(', 'g');
  end loop;

  -- -------------------------------------------------------------------------
  -- 3) Si quedó una copia en `public` —una base que volvió a correr un archivo viejo
  --    después de mover éstas—, se borra.
  --
  -- Sin `cascade`, a propósito: si alguna política todavía apunta a la copia de
  -- `public`, Postgres se niega, dice cuál, y no se aplica nada. En ese caso vuelve a
  -- correr el archivo de esa política (ya escrito contra `private`) y después éste.
  -- -------------------------------------------------------------------------
  foreach f in array firmas loop
    if to_regprocedure('public.' || f) is not null
       and to_regprocedure('private.' || f) is not null then
      execute format('drop function public.%s', f);
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- 4) Permisos: `authenticated` sí —las políticas las necesitan—, nadie más.
  -- -------------------------------------------------------------------------
  foreach f in array firmas loop
    if to_regprocedure('private.' || f) is not null then
      execute format('revoke all on function private.%s from public, anon', f);
      execute format('grant execute on function private.%s to authenticated', f);
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- 5) Comprobarlo antes de dar nada por hecho. Cualquier fallo aquí deshace todo.
  -- -------------------------------------------------------------------------
  select string_agg(f2, ', ') into v_resto
    from unnest(firmas) as f2
   where to_regprocedure('public.' || f2) is not null;
  if v_resto is not null then
    raise exception 'Siguen en public: %', v_resto;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_resto
    from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and p.prosrc ~ llamada;
  if v_resto is not null then
    raise exception 'Siguen llamando a las de public: %', v_resto;
  end if;

end
$privado$;

-- Que la API se entere ya de que esos `/rpc` dejaron de existir.
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- Verificación
--
--   db/03_verificacion.sql, consultas 6, 12, 13 y 14.
--
--   En el linter de Supabase (Advisors → Security) queda UN 0029: `accept_center_invite`,
--   que la app llama a propósito para que un gestor reciba su punto.
--
--   Por la API, con la anon key, `POST /rest/v1/rpc/is_staff` tiene que dar 404 —antes
--   daba 401—. Y en el navegador, con las cuentas de prueba: el equipo sigue guardando
--   un punto y viendo la cola; el gestor, su panel y sus borradores.
-- ---------------------------------------------------------------------------
