-- ===========================================================================
-- db/09_endurecimiento.sql — quién puede llamar a cada función, escrito en un sitio
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `015_endurecimiento` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro.
--
-- CÓMO SE CORRE, en una base que ya existía:
--
--   1. db/06_reconocimiento.sql otra vez (es idempotente). Trae la tabla de posiciones
--      sin `security definer` y el trigger `reward_applied_report`, que se había caído
--      del repositorio aunque seguía vivo en la base.
--   2. Este archivo.
--   3. db/03_verificacion.sql, consultas 7, 12 y 13.
--
-- En una base nueva no hay que hacer nada: va al final de 01_esquema.sql.
--
-- Funciona aunque a esa base le falten migraciones —Colombia no tiene 05…07 todavía—:
-- lo que no existe se salta, en vez de abortar el archivo a la mitad.
--
-- ---------------------------------------------------------------------------
-- EL AGUJERO QUE CIERRA
--
-- Cada `create function` en `public` le da EXECUTE a tres: a PUBLIC (lo hace Postgres) y
-- a `anon` y `authenticated` POR NOMBRE (lo hace Supabase, con privilegios por defecto).
-- Los archivos de este repositorio cerraban sus funciones con `revoke ... from public`,
-- que quita el primero y deja los otros dos donde estaban.
--
-- O sea: toda función `security definer` de la base se podía llamar por
-- `/rest/v1/rpc/<nombre>` con la anon key, que viaja en el bundle. Comprobado contra la
-- base de Venezuela el 2026-09-10, sin escribir nada:
--
--   • `record_contribution` —la que su propio comentario dice que «ya no la puede llamar
--     el cliente»— la ejecutaba `anon`. Con un `user_id` sacado de la tabla de
--     posiciones, que los publica, cualquiera podía regalarle el nivel a quien quisiera.
--   • `evaluate_badges`, igual, sin sesión.
--
-- Es lo que el linter de Supabase marca como 0028 (anon) y 0029 (authenticated).
--
-- ---------------------------------------------------------------------------
-- LA REGLA
--
-- Una función `security definer` en `public` la puede llamar exactamente quien la
-- necesita, y eso se escribe AQUÍ, en una lista, y no repartido por nueve archivos. Hay
-- cuatro casos y toda función cae en uno:
--
--   A. SÓLO LA LLAMA UN TRIGGER      → nadie. Un trigger no comprueba EXECUTE al
--                                      dispararse, sólo al crearse: cerrarla no cambia
--                                      lo que hace, sólo quita la puerta por `/rpc`.
--   B. SÓLO LA LLAMA EL SERVIDOR     → `service_role`.
--   C. LA LLAMA UNA POLÍTICA RLS     → `authenticated`, y no `anon`. Viven en
--                                      `private` (ver 11_privado.sql): no son endpoints.
--   D. LA LLAMA LA APP CON SESIÓN    → `authenticated`.
--
-- ⚠️ El caso C es el que hay que entender antes de tocarlo. Una política ejecuta sus
-- funciones COMO QUIEN CONSULTA: si `authenticated` pierde EXECUTE sobre `is_staff()`,
-- cada escritura del equipo falla con «permission denied for function is_staff». Por eso
-- siguen abiertas para `authenticated` — y por eso viven en `private`, donde ese permiso
-- no las convierte en un `/rest/v1/rpc/is_staff` que cualquiera con sesión puede llamar.
--
-- `anon` sí las pierde: todas las políticas que las usan son `to authenticated`, así que
-- una consulta sin sesión nunca las evalúa. El bloque de abajo lo comprueba contra
-- `pg_policies` antes de cerrarlas, por si la base viva tuviera una política que no está
-- en el repositorio — ya pasó con `reward_applied_report`. Si la encuentra, aborta sin
-- haber tocado nada y dice cuál es.
--
-- Lo que NO se hace: cambiar los privilegios por defecto para que lo nuevo nazca cerrado.
-- Sería lo limpio, y deja una trampa: una migración anterior corrida DESPUÉS de ésta —el
-- orden de Colombia, por ejemplo— crearía cerradas funciones que sus políticas necesitan,
-- y eso se rompe en producción, con el equipo intentando guardar. La red es otra: la
-- consulta 12 de 03_verificacion.sql y el propio linter.
-- ===========================================================================

do $matriz$
declare
  f     text;
  v_pol text;
begin

  -- -------------------------------------------------------------------------
  -- A) Sólo las llama un trigger → nadie.
  -- -------------------------------------------------------------------------
  foreach f in array array[
    'public.audit_row()',
    'public.guard_submission_status()',
    'public.guard_volunteer_request_status()',
    'public.guard_point_report_status()',
    'public.set_point_report_emergency()',
    'public.set_emergency_from_location()',
    'public.stamp_raised_declaration()',
    'public.stamp_donation_review()',
    'public.reward_confirmed_donation()',
    'public.reward_applied_report()',
    'public.evaluate_badges_on_contribution()'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', f);
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- B) Sólo el servidor → `service_role`.
  --
  -- `record_contribution` la llama /api/checkin con el service role, DESPUÉS de comprobar
  -- que la persona está en el punto. `evaluate_badges` ni eso: la llama un trigger que
  -- corre como su dueño.
  -- -------------------------------------------------------------------------
  foreach f in array array[
    'public.record_contribution(text, text, uuid)',
    'public.evaluate_badges(uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', f);
    end if;
  end loop;

  if to_regprocedure('public.record_contribution(text, text, uuid)') is not null then
    grant execute on function public.record_contribution(text, text, uuid) to service_role;
  end if;

  -- -------------------------------------------------------------------------
  -- C) Las llaman las políticas RLS → `authenticated`, y no `anon`.
  -- -------------------------------------------------------------------------
  foreach f in array array[
    'private.is_staff()',
    'private.is_admin()',
    'private.is_superadmin()',
    'private.belongs_to(uuid)',
    'private.can_edit(uuid)',
    'private.can_delete(uuid)',
    'private.manages_location(text)',
    'private.can_manage_location(text)'
  ] loop
    continue when to_regprocedure(f) is null;

    -- ¿Alguna política que alcance a `anon` la evalúa? Entonces cerrarla rompería esa
    -- tabla para quien llega sin cuenta. Se busca el nombre seguido de `(`, en cualquier
    -- esquema —`storage.objects` también tiene políticas—.
    select string_agg(format('%s.%s · %s', schemaname, tablename, policyname), ', ')
      into v_pol
      from pg_policies
     where roles && array['anon', 'public']::name[]
       and concat_ws(' ', qual, with_check)
           ~ ('\m' || split_part(split_part(f, '.', 2), '(', 1) || '\(');

    if v_pol is not null then
      raise exception
        'No se cierra % para anon: la evalúan políticas que alcanzan a anon (%). Revísalas antes.',
        f, v_pol;
    end if;

    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  -- -------------------------------------------------------------------------
  -- D) Las llama la app con sesión → `authenticated`.
  --
  -- `accept_center_invite` es la puerta para que un gestor reciba su punto. Su primera
  -- línea ya rechaza a quien no tiene sesión; quitarle `anon` sólo quita el ruido.
  -- -------------------------------------------------------------------------
  if to_regprocedure('public.accept_center_invite(text)') is not null then
    revoke all on function public.accept_center_invite(text) from public, anon;
    grant execute on function public.accept_center_invite(text) to authenticated;
  end if;

  -- -------------------------------------------------------------------------
  -- `search_path` fijo en las dos que no lo tenían (linter 0011).
  --
  -- Ninguna lee una tabla, así que vacío no les cuesta nada. Ya está en su definición;
  -- esto es para las bases donde se crearon antes de que lo estuviera.
  -- -------------------------------------------------------------------------
  foreach f in array array[
    'public.contribution_points(text)',
    'public.audit_entity_visible_to_staff(text)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s set search_path = %L', f, '');
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- Lo que se escapó de la lista.
  --
  -- Una función `security definer` que `anon` todavía puede llamar es una que se creó
  -- después de este archivo y nadie clasificó. No se cierra a ciegas —podría ser una que
  -- la app necesita—: se avisa, y hay que meterla en A, B, C o D.
  -- -------------------------------------------------------------------------
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname)
    into v_pol
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prosecdef
     and has_function_privilege('anon', p.oid, 'execute');

  if v_pol is not null then
    raise warning 'Siguen abiertas a anon, y no están en esta lista: %', v_pol;
  end if;

end
$matriz$;


-- ---------------------------------------------------------------------------
-- Verificación
--
--   db/03_verificacion.sql, consultas 12 y 13.
--
--   Y en el linter de Supabase (Advisors → Security) tienen que desaparecer todos los
--   0028, el 0010 de `leaderboard` y los dos 0011. Con 11_privado.sql aplicado, queda
--   UN 0029, y es el que tiene que quedar: `accept_center_invite`, que la app llama a
--   propósito (caso D).
--
--   Por la API, con la anon key, `POST /rest/v1/rpc/evaluate_badges` tiene que responder
--   401 o 403 —antes respondía 204—, y `GET /rest/v1/leaderboard` seguir respondiendo 200.
-- ---------------------------------------------------------------------------
