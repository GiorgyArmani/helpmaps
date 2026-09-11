-- HelpMaps · verificación de exposición de datos — córrelo en el editor SQL de Supabase.
--
-- Es de SOLO LECTURA: inspecciona el estado de RLS, lista las políticas y simula el rol
-- `anon`. No modifica nada, así que se puede correr en producción sin miedo.
--
-- Por qué existe: la aplicación habla con Supabase DIRECTAMENTE desde el navegador con la
-- anon key, que es pública por diseño. Eso significa que RLS no es una capa más de
-- defensa — es TODA la defensa. Una tabla sin RLS, o una política de más, es una fuga,
-- no un aviso.
--
-- Córrelo después de CADA cambio de esquema. `db/01_esquema.sql § 001_core` te manda aquí por eso.
--
-- Lo que es público a propósito: `locations`, `center_info`, `app_settings` y las
-- `donations` activas. Encontrarlas legibles NO es un hallazgo: el mapa existe para eso.
-- Lo que no puede leer nadie de fuera: `submissions`, `volunteer_requests`, `audit_log`,
-- y `staff_users` salvo la propia fila.

-- ---------------------------------------------------------------------------
-- 1) ¿Tiene RLS activado cada tabla?
--    SE ESPERA: rls_enabled = true en TODAS. Cualquier `false` está EXPUESTA.
-- ---------------------------------------------------------------------------
select c.relname             as tabla,
       c.relrowsecurity      as rls_enabled,
       c.relforcerowsecurity as rls_forzado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity, 1;

-- ---------------------------------------------------------------------------
-- 2) FALLO CRÍTICO: ¿puede `anon` LEER algo que contiene personas?
--
--    SE ESPERA: 0 filas.
--
--    Quien avisa de que un albergue se quedó sin agua, o quien se ofrece de voluntario,
--    no aceptó que eso se publicara. Esta consulta es la razón de ser de RLS en este
--    proyecto: una sola fila aquí es una filtración de nombres, correos y teléfonos.
-- ---------------------------------------------------------------------------
select tablename as tabla, policyname as politica, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('submissions', 'volunteer_requests', 'audit_log')
  and cmd in ('SELECT', 'ALL')
  and (roles && array['anon', 'public']::name[])
order by 1, 2;

-- ---------------------------------------------------------------------------
-- 3) FALLO CRÍTICO: ¿puede alguien que no es staff ESCRIBIR el mapa?
--
--    SE ESPERA: 0 filas.
--
--    Un punto en una dirección equivocada es el fallo que define a esta aplicación: una
--    persona enviada a ningún sitio, en una emergencia, quizá de noche y con toque de
--    queda. Escribir el mapa es solo del equipo, y borrar solo de un admin.
-- ---------------------------------------------------------------------------
select tablename as tabla, policyname as politica, cmd, roles, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('locations', 'center_info', 'donations', 'app_settings', 'staff_users')
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and (roles && array['anon', 'public']::name[])
order by 1, 3;

-- ---------------------------------------------------------------------------
-- 4) Todas las políticas, para revisarlas a ojo.
--    Lee `qual` (quién puede ver la fila) y `with_check` (qué puede escribir).
-- ---------------------------------------------------------------------------
select tablename as tabla, policyname as politica, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- ---------------------------------------------------------------------------
-- 5) Tablas con RLS activado y NINGUNA política.
--
--    No es una fuga: es lo contrario, nadie puede leerlas ni escribirlas. Suele
--    significar que una migración creó la tabla y se olvidó de las políticas, y se
--    manifiesta como una pantalla vacía sin error. SE ESPERA: 0 filas.
-- ---------------------------------------------------------------------------
select c.relname as tabla
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname
  )
order by 1;

-- ---------------------------------------------------------------------------
-- 6) `search_path` en las funciones de seguridad.
--
--    `is_staff()`, `is_admin()` y las funciones de alcance deciden quién escribe. Una
--    función SECURITY DEFINER sin `search_path` fijo se puede secuestrar creando un
--    objeto con el mismo nombre en un esquema que vaya antes.
--
--    Antes esta consulta llevaba la lista de nombres a mano. Se cambió a "todas las
--    SECURITY DEFINER de public" porque la lista se quedó vieja en cuanto el esquema
--    creció: las funciones de alcance de 008 existían, estaban bien, y el chequeo no las
--    miraba. Una verificación que hay que acordarse de actualizar no es una verificación.
--
--    SE ESPERA: 0 filas. Cualquier fila aquí es una función que puede ser secuestrada.
-- ---------------------------------------------------------------------------
select p.oid::regprocedure as funcion_secdef_sin_search_path,
       p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
-- `private` también: que la API no las publique no quita que las llamen las políticas.
where n.nspname in ('public', 'private')
  and p.prosecdef
  and (p.proconfig is null or not (p.proconfig::text like '%search_path=%'))
order by 1;

--    Y el inventario completo, para leerlo de un vistazo:
select p.proname    as funcion,
       p.prosecdef  as security_definer,
       p.proconfig  as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
order by p.prosecdef desc, 1;

-- ---------------------------------------------------------------------------
-- 7) Vistas SECURITY DEFINER, que saltan el RLS de quien consulta.
--
--    Una vista es SECURITY DEFINER si NO dice `security_invoker = true`: es lo de por
--    defecto, no algo que haya que pedir. Esta consulta buscaba al revés —vistas CON la
--    opción puesta—, así que señalaba justo la que estaba bien, `point_report_counts`, y
--    dejó pasar `leaderboard`. Lo encontró el linter de Supabase el 2026-09-10.
--
--    SE ESPERA: 0 filas.
-- ---------------------------------------------------------------------------
select c.relname as vista_security_definer
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and not exists (
    select 1 from unnest(c.reloptions) o
    where o ~* '^security_invoker=(true|on|yes|1)$'
  )
order by 1;

-- ---------------------------------------------------------------------------
-- 8) LA PRUEBA DE VERDAD: hacerse pasar por `anon` y tocar lo privado.
--
--    Los pasos 2 y 3 leen la CONFIGURACIÓN; esto ejecuta el ATAQUE. Es lo que de verdad
--    responde a la pregunta, porque una política puede parecer correcta y no serlo.
--
--    SE ESPERA: las tres cuentas en 0. Cualquier otra cosa es una fuga real y en curso.
--    (Con RLS, `anon` no recibe un error: recibe cero filas. Por eso se cuenta.)
-- ---------------------------------------------------------------------------
begin;
  set local role anon;

  select 'submissions'        as tabla, count(*) as filas_visibles_para_anon from public.submissions
  union all
  select 'volunteer_requests', count(*) from public.volunteer_requests
  union all
  select 'audit_log',          count(*) from public.audit_log;

rollback;

-- ---------------------------------------------------------------------------
-- 9) Contraste: lo que `anon` SÍ debe ver. Si esto da 0 con datos cargados, el mapa
--    está en blanco para el público y es un fallo igual de grave, en el otro sentido.
-- ---------------------------------------------------------------------------
begin;
  set local role anon;

  select 'locations'   as tabla, count(*) as filas_visibles_para_anon from public.locations
  union all
  select 'center_info', count(*) from public.center_info;

rollback;

-- ---------------------------------------------------------------------------
-- 10) Cuentas de persona (db/01_esquema.sql § 010_accounts).
--
--     SE ESPERA: las tres en 0.
--
--     `profiles` no lleva correo a propósito, pero sí lleva el nombre que eligió cada
--     quien, y una lista de quién tiene cuenta en un mapa de emergencia no es inofensiva.
--     `point_reports` dice quién estuvo mirando qué punto. `favourites` es la peor de las
--     tres: es un mapa de por dónde se mueve una persona.
--
--     ⚠️ Un 0 acá con las tablas VACÍAS no prueba nada — no distingue "la política lo
--     impide" de "no hay filas". Vuelve a correr esto cuando haya cuentas reales; hasta
--     entonces, lo que vale es la consulta 11.
-- ---------------------------------------------------------------------------
begin;
  set local role anon;

  select 'profiles'      as tabla, count(*) as filas_visibles_para_anon from public.profiles
  union all
  select 'favourites',    count(*) from public.favourites
  union all
  select 'point_reports', count(*) from public.point_reports;

rollback;

-- ---------------------------------------------------------------------------
-- 11) ¿Tiene cada tabla nueva las políticas que creemos, y NINGUNA de más?
--
--     Esto sí sirve con las tablas vacías, porque lee la configuración y no los datos.
--
--     SE ESPERA, exactamente:
--       favourites     1 política  (favourites_own, ALL, sin excepción para admin)
--       profiles       3           (profiles_read —propio, equipo o, con 07_aportes, el
--                                   gestor que recibió su aporte— + self insert/update)
--       point_reports  3           (insert propio, read propio-o-equipo, update equipo)
--
--     Que `favourites` tenga MÁS de una política es el hallazgo a buscar: significaría
--     que alguien le abrió una puerta al equipo, y esa tabla no la tiene que tener.
-- ---------------------------------------------------------------------------
select tablename  as tabla,
       policyname as politica,
       cmd        as operacion,
       roles::text
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'favourites', 'point_reports')
order by tablename, policyname;

-- ---------------------------------------------------------------------------
-- 12) FALLO CRÍTICO: funciones SECURITY DEFINER que se pueden llamar SIN CUENTA.
--
--     Cada una es una puerta por `/rest/v1/rpc/<nombre>` que corre con los permisos de
--     su dueño, abierta a cualquiera con la anon key. `revoke ... from public` NO la
--     cierra: Supabase le da EXECUTE a `anon` por nombre. Ver db/09_endurecimiento.sql.
--
--     SE ESPERA: 0 filas. Una fila es una función que hay que clasificar en 09.
-- ---------------------------------------------------------------------------
select p.oid::regprocedure as funcion_abierta_a_anon
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')
order by 1;

-- ---------------------------------------------------------------------------
-- 13) Y las que puede llamar alguien CON cuenta.
--
--     SE ESPERA, exactamente (casos C y D de db/09_endurecimiento.sql):
--
--       public.accept_center_invite      ← la única que es un endpoint de la API
--       private.belongs_to, private.can_delete, private.can_edit, private.is_admin,
--       private.is_staff, private.is_superadmin
--       private.can_manage_location, private.manages_location   (sólo con 05_iniciativas)
--       private.leaderboard_rows                                 (sólo con 06_reconocimiento)
--
--     Una de más es una función que nadie decidió abrir. Una de menos, si es de las de
--     `private`, es el equipo sin poder guardar. Y una de las de `private` apareciendo en
--     `public` es una base que volvió a correr un archivo viejo: ver 11_privado.sql.
-- ---------------------------------------------------------------------------
select p.oid::regprocedure as funcion_abierta_a_authenticated
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prosecdef
  and has_function_privilege('authenticated', p.oid, 'execute')
order by n.nspname desc, 1;

-- ---------------------------------------------------------------------------
-- 14) Dos políticas permisivas para el mismo rol y el mismo verbo.
--
--     Es el aviso 0006 del linter. No es una fuga —Postgres las junta con OR—, pero
--     quiere decir que para saber quién ve qué hay que sumar políticas de secciones
--     distintas, y así es como se cuela una de más sin que nadie la vea. Un `for all`
--     cuenta para los cuatro verbos, y por eso se expande. Ver db/10_politicas.sql.
--
--     SE ESPERA: 0 filas.
-- ---------------------------------------------------------------------------
select p.tablename                                   as tabla,
       r.rol,
       v.verbo,
       string_agg(p.policyname, ', ' order by p.policyname) as politicas
from pg_policies p
cross join unnest(p.roles) as r(rol)
cross join unnest(
  case when p.cmd = 'ALL' then array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] else array[p.cmd] end
) as v(verbo)
where p.schemaname = 'public'
  and p.permissive = 'PERMISSIVE'
group by 1, 2, 3
having count(*) > 1
order by 1, 2, 3;

-- ---------------------------------------------------------------------------
-- 15) Funciones que llaman a las de alcance SIN decir en qué esquema están.
--
--     Desde 11_privado.sql viven en `private`, y una función cuyo cuerpo diga `is_staff()`
--     a secas las busca en su `search_path` —`public`— y no las encuentra. No falla al
--     crearse ni al migrar: falla la primera vez que se ejecuta, que en un trigger de
--     guardia es cuando alguien del equipo intenta resolver algo. Las políticas no tienen
--     este problema: guardan la función por su OID, no por su nombre.
--
--     SE ESPERA: 0 filas. Una fila se arregla escribiendo `private.` delante.
-- ---------------------------------------------------------------------------
select p.oid::regprocedure as funcion_con_llamada_sin_esquema
from pg_proc p
where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
  and p.prosrc ~ '(^|[^.[:alnum:]_])(is_staff|is_admin|is_superadmin|belongs_to|can_edit|can_delete|manages_location|can_manage_location)\s*\('
order by 1;
