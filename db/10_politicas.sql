-- ===========================================================================
-- db/10_politicas.sql — una política por tabla, rol y verbo
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `016_politicas` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro.
--
-- CÓMO SE CORRE: entero, en el editor SQL, DESPUÉS de 09_endurecimiento.sql. Es un solo
-- bloque, así que o se aplica todo o no se aplica nada: no hay un momento intermedio en
-- el que el equipo haya perdido una política y todavía no tenga la que la sustituye.
--
-- Funciona aunque a esa base le falten migraciones: lo de 05_iniciativas.sql y
-- 07_aportes.sql sólo se toca si sus tablas existen.
--
-- ⚠️ Si después vuelves a correr una migración ANTERIOR (01, 05 o 07), ésta recrea sus
-- políticas viejas junto a las de aquí. No abre nada —el resultado es el mismo OR—, pero
-- el linter vuelve a quejarse. Vuelve a correr este archivo y queda como estaba.
--
-- ---------------------------------------------------------------------------
-- QUÉ RESUELVE
--
-- El aviso 0006 del linter de Supabase, «Multiple Permissive Policies»: dos o más
-- políticas permisivas para el mismo rol y el mismo verbo. Había quince, y todas por una
-- de estas tres razones:
--
--   1. Una lectura pública `to anon, authenticated` y otra sólo para `authenticated`
--      (el equipo, el gestor). Para `authenticated` eran dos.
--   2. Un `for all` de escritura, que también cuenta como SELECT y se solapaba con la
--      política de lectura.
--   3. Dos secciones que añadieron, cada una, su política al mismo verbo: el equipo y
--      el gestor escribiendo en `center_info`, por ejemplo.
--
-- Y la solución es la misma para las tres: juntarlas con OR en una sola. Postgres ya las
-- combina así por dentro, de modo que NADIE GANA NI PIERDE ACCESO — cada política de
-- abajo es, literalmente, el OR de las que sustituye. Lo que cambia es que ahora se lee
-- en un sitio quién ve qué, en vez de tener que sumar políticas de tres secciones.
--
-- ── EL RENDIMIENTO, SIN EXAGERAR ────────────────────────────────────────────
--
-- Juntarlas, por sí solo, apenas cambia el plan: el OR ya estaba. Lo que sí ahorra es que
-- las funciones que no dependen de la fila —`is_staff()`, `is_admin()`,
-- `is_superadmin()`— van ahora como `(select private.is_staff())`. Así Postgres las
-- evalúa UNA vez por consulta y no una por fila, que en una tabla de cien filas son cien
-- lecturas de `staff_users` menos. Las que reciben una columna (`can_edit(emergency_id)`,
-- `can_manage_location(location_id)`) no se pueden sacar así, porque su respuesta cambia
-- de fila a fila.
--
-- ── POR QUÉ LA LECTURA PÚBLICA SE PARTE EN DOS, Y NO SE JUNTA EN UNA ─────────
--
-- Lo tentador sería una sola política `to anon, authenticated using (pública or
-- gestor)`. No se puede: desde 09_endurecimiento.sql `anon` no tiene EXECUTE sobre
-- `can_manage_location()` ni sobre `is_staff()`, y Postgres no promete evaluar el OR de
-- izquierda a derecha. En cuanto una fila no fuera pública, la consulta de un visitante
-- fallaría con «permission denied for function» — el mapa en blanco. Así que `anon` se
-- queda con su política de siempre, sin funciones, y `authenticated` con una que dice
-- «lo público, o lo tuyo».
-- ===========================================================================

do $politicas$
begin

  -- =========================================================================
  -- 1) Lecturas públicas + lo que ve el equipo
  -- =========================================================================

  -- donations: las activas para todos; el equipo, también las desactivadas.
  drop policy if exists donations_staff_read  on public.donations;
  drop policy if exists donations_public_read on public.donations;
  drop policy if exists donations_read        on public.donations;
  create policy donations_public_read on public.donations
    for select to anon using (active);
  create policy donations_read on public.donations
    for select to authenticated
    using (active or (select private.is_staff()));

  -- emergencies: las publicadas para todos; el equipo ve también los borradores. Un
  -- superadmin tenía además la lectura de su `for all`, pero es staff —está en
  -- `staff_users`—, así que `is_staff()` ya lo incluye.
  drop policy if exists emergencies_staff_read  on public.emergencies;
  drop policy if exists emergencies_public_read on public.emergencies;
  drop policy if exists emergencies_read        on public.emergencies;
  create policy emergencies_public_read on public.emergencies
    for select to anon using (status <> 'draft');
  create policy emergencies_read on public.emergencies
    for select to authenticated
    using (status <> 'draft' or (select private.is_staff()));

  -- emergency_phones: los activos para todos; el equipo de esa emergencia, todos.
  drop policy if exists emergency_phones_public_read on public.emergency_phones;
  drop policy if exists emergency_phones_read        on public.emergency_phones;
  create policy emergency_phones_public_read on public.emergency_phones
    for select to anon using (active);
  create policy emergency_phones_read on public.emergency_phones
    for select to authenticated
    using (active or private.can_edit(emergency_id));


  -- =========================================================================
  -- 2) Lo propio + lo que ve el equipo
  -- =========================================================================

  -- submissions: quien la mandó ve la suya; el equipo de esa emergencia, todas.
  drop policy if exists submissions_own_read   on public.submissions;
  drop policy if exists submissions_staff_read on public.submissions;
  drop policy if exists submissions_read       on public.submissions;
  create policy submissions_read on public.submissions
    for select to authenticated
    using (created_by = (select auth.uid()) or private.can_edit(emergency_id));

  -- volunteer_requests: quien se ofreció ve la suya; un admin de esa emergencia, todas.
  drop policy if exists volunteer_requests_own_read   on public.volunteer_requests;
  drop policy if exists volunteer_requests_admin_read on public.volunteer_requests;
  drop policy if exists volunteer_requests_read       on public.volunteer_requests;
  create policy volunteer_requests_read on public.volunteer_requests
    for select to authenticated
    using (user_id = (select auth.uid()) or private.can_delete(emergency_id));

  -- profiles: el propio y el equipo. Y, si existe 07_aportes.sql, el gestor ve el
  -- nombre de quien LE declaró un aporte a él — ver allí por qué, y por qué nada más.
  drop policy if exists profiles_self_read  on public.profiles;
  drop policy if exists profiles_staff_read on public.profiles;
  drop policy if exists profiles_donor_read on public.profiles;
  drop policy if exists profiles_read       on public.profiles;
  if to_regclass('public.donation_claims') is null then
    create policy profiles_read on public.profiles
      for select to authenticated
      using (user_id = (select auth.uid()) or (select private.is_staff()));
  else
    create policy profiles_read on public.profiles
      for select to authenticated
      using (
        user_id = (select auth.uid())
        or (select private.is_staff())
        or exists (
          select 1 from public.donation_claims d
          where d.user_id = profiles.user_id
            and private.can_manage_location(d.location_id)
        )
      );
  end if;


  -- =========================================================================
  -- 3) Los `for all` se parten en sus verbos
  --
  -- Un `for all` también es un SELECT, y se solapaba con la política de lectura, que ya
  -- decía lo mismo o más. Partido en INSERT, UPDATE y DELETE, escribe exactamente lo que
  -- escribía y deja de contar como lectura.
  -- =========================================================================

  -- staff_users: sólo un admin da de alta, cambia o quita a alguien del equipo.
  -- (Leer sigue en `staff_users_self_read`: la propia fila, o un admin todas.)
  drop policy if exists staff_users_admin_write  on public.staff_users;
  drop policy if exists staff_users_admin_insert on public.staff_users;
  drop policy if exists staff_users_admin_update on public.staff_users;
  drop policy if exists staff_users_admin_delete on public.staff_users;
  create policy staff_users_admin_insert on public.staff_users
    for insert to authenticated with check ((select private.is_admin()));
  create policy staff_users_admin_update on public.staff_users
    for update to authenticated
    using ((select private.is_admin())) with check ((select private.is_admin()));
  create policy staff_users_admin_delete on public.staff_users
    for delete to authenticated using ((select private.is_admin()));

  -- staff_emergencies: sólo un superadmin reparte a quién alcanza cada emergencia.
  -- (Leer sigue en `staff_emergencies_self_read`.)
  drop policy if exists staff_emergencies_super_write  on public.staff_emergencies;
  drop policy if exists staff_emergencies_super_insert on public.staff_emergencies;
  drop policy if exists staff_emergencies_super_update on public.staff_emergencies;
  drop policy if exists staff_emergencies_super_delete on public.staff_emergencies;
  create policy staff_emergencies_super_insert on public.staff_emergencies
    for insert to authenticated with check ((select private.is_superadmin()));
  create policy staff_emergencies_super_update on public.staff_emergencies
    for update to authenticated
    using ((select private.is_superadmin())) with check ((select private.is_superadmin()));
  create policy staff_emergencies_super_delete on public.staff_emergencies
    for delete to authenticated using ((select private.is_superadmin()));

  -- emergency_phones: el equipo de esa emergencia mantiene sus teléfonos.
  drop policy if exists emergency_phones_staff_write  on public.emergency_phones;
  drop policy if exists emergency_phones_staff_insert on public.emergency_phones;
  drop policy if exists emergency_phones_staff_update on public.emergency_phones;
  drop policy if exists emergency_phones_staff_delete on public.emergency_phones;
  create policy emergency_phones_staff_insert on public.emergency_phones
    for insert to authenticated with check (private.can_edit(emergency_id));
  create policy emergency_phones_staff_update on public.emergency_phones
    for update to authenticated
    using (private.can_edit(emergency_id)) with check (private.can_edit(emergency_id));
  create policy emergency_phones_staff_delete on public.emergency_phones
    for delete to authenticated using (private.can_edit(emergency_id));

  -- emergencies: crear y borrar una emergencia es de un superadmin. Cambiarla, de un
  -- superadmin o de un admin de ESA emergencia —el aviso y el modo mantenimiento—.
  --
  -- ⚠️ Lo de «sólo el aviso y el modo mantenimiento» lo dice el comentario de
  -- `emergencies_admin_notice` en 008, y NO lo impone nada: RLS decide qué FILAS, no qué
  -- columnas, y no hay trigger ni permiso por columna que lo frene. Hoy un admin puede
  -- cambiar cualquier campo de su emergencia. Esto no lo abre ni lo cierra; lo deja
  -- escrito donde se va a leer.
  drop policy if exists emergencies_super_write  on public.emergencies;
  drop policy if exists emergencies_admin_notice on public.emergencies;
  drop policy if exists emergencies_super_insert on public.emergencies;
  drop policy if exists emergencies_super_delete on public.emergencies;
  drop policy if exists emergencies_update       on public.emergencies;
  create policy emergencies_super_insert on public.emergencies
    for insert to authenticated with check ((select private.is_superadmin()));
  create policy emergencies_super_delete on public.emergencies
    for delete to authenticated using ((select private.is_superadmin()));
  create policy emergencies_update on public.emergencies
    for update to authenticated
    using (
      (select private.is_superadmin())
      or ((select private.is_admin()) and private.belongs_to(id))
    )
    with check (
      (select private.is_superadmin())
      or ((select private.is_admin()) and private.belongs_to(id))
    );


  -- =========================================================================
  -- 4) Lo de 05_iniciativas.sql: el gestor de un punto
  -- =========================================================================

  if to_regclass('public.center_managers') is not null then

    -- center_info: la escribe el equipo de esa emergencia, o quien gestiona ese punto.
    -- Las dos, INSERT incluido: el onboarding guarda con upsert, y un upsert exige la
    -- política de INSERT aunque la fila ya exista (ver 05_iniciativas.sql).
    drop policy if exists center_info_staff_insert   on public.center_info;
    drop policy if exists center_info_manager_insert on public.center_info;
    drop policy if exists center_info_insert         on public.center_info;
    create policy center_info_insert on public.center_info
      for insert to authenticated
      with check (
        private.manages_location(location_id)
        or private.can_edit((select l.emergency_id from public.locations l where l.id = location_id))
      );

    drop policy if exists center_info_staff_update   on public.center_info;
    drop policy if exists center_info_manager_update on public.center_info;
    drop policy if exists center_info_update         on public.center_info;
    create policy center_info_update on public.center_info
      for update to authenticated
      using (
        private.manages_location(location_id)
        or private.can_edit((select l.emergency_id from public.locations l where l.id = location_id))
      )
      with check (
        private.manages_location(location_id)
        or private.can_edit((select l.emergency_id from public.locations l where l.id = location_id))
      );

    -- center_managers: invitar y revocar es del equipo de esa emergencia.
    -- (Leer sigue en `center_managers_read`: lo propio, o el equipo.)
    drop policy if exists center_managers_staff_write  on public.center_managers;
    drop policy if exists center_managers_staff_insert on public.center_managers;
    drop policy if exists center_managers_staff_update on public.center_managers;
    drop policy if exists center_managers_staff_delete on public.center_managers;
    create policy center_managers_staff_insert on public.center_managers
      for insert to authenticated
      with check (private.can_edit((select emergency_id from public.locations where id = location_id)));
    create policy center_managers_staff_update on public.center_managers
      for update to authenticated
      using (private.can_edit((select emergency_id from public.locations where id = location_id)))
      with check (private.can_edit((select emergency_id from public.locations where id = location_id)));
    create policy center_managers_staff_delete on public.center_managers
      for delete to authenticated
      using (private.can_edit((select emergency_id from public.locations where id = location_id)));

  end if;

  -- campaigns, activities, initiative_posts: lo publicado de un punto activo para todos;
  -- quien gestiona ese punto, además, sus borradores.
  if to_regclass('public.campaigns') is not null then

    drop policy if exists campaigns_manager_read on public.campaigns;
    drop policy if exists campaigns_public_read  on public.campaigns;
    drop policy if exists campaigns_read         on public.campaigns;
    create policy campaigns_public_read on public.campaigns
      for select to anon
      using (
        status in ('active','reached','closed')
        and exists (select 1 from public.locations l where l.id = location_id and l.active)
      );
    create policy campaigns_read on public.campaigns
      for select to authenticated
      using (
        (
          status in ('active','reached','closed')
          and exists (select 1 from public.locations l where l.id = location_id and l.active)
        )
        or private.can_manage_location(location_id)
      );

    drop policy if exists activities_manager_read on public.activities;
    drop policy if exists activities_public_read  on public.activities;
    drop policy if exists activities_read         on public.activities;
    create policy activities_public_read on public.activities
      for select to anon
      using (
        status in ('scheduled','done','cancelled')
        and exists (select 1 from public.locations l where l.id = location_id and l.active)
      );
    create policy activities_read on public.activities
      for select to authenticated
      using (
        (
          status in ('scheduled','done','cancelled')
          and exists (select 1 from public.locations l where l.id = location_id and l.active)
        )
        or private.can_manage_location(location_id)
      );

    drop policy if exists initiative_posts_manager_read on public.initiative_posts;
    drop policy if exists initiative_posts_public_read  on public.initiative_posts;
    drop policy if exists initiative_posts_read         on public.initiative_posts;
    create policy initiative_posts_public_read on public.initiative_posts
      for select to anon
      using (
        status = 'published'
        and exists (select 1 from public.locations l where l.id = location_id and l.active)
      );
    create policy initiative_posts_read on public.initiative_posts
      for select to authenticated
      using (
        (
          status = 'published'
          and exists (select 1 from public.locations l where l.id = location_id and l.active)
        )
        or private.can_manage_location(location_id)
      );

  end if;

end
$politicas$;


-- ---------------------------------------------------------------------------
-- Verificación
--
--   db/03_verificacion.sql, consulta 14: tiene que dar 0 filas. Es la misma pregunta
--   que el aviso 0006 del linter.
--
--   Y la de verdad, en el navegador: el mapa sin sesión sigue enseñando campañas y
--   actividades; con la cuenta de gestor de las cuentas de prueba, su panel sigue
--   enseñando los borradores y guarda; con la del equipo, la cola de sugerencias.
-- ---------------------------------------------------------------------------
