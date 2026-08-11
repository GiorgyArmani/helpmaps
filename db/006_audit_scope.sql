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
