-- ===========================================================================
-- db/20_sugerencias_con_puntos.sql — una sugerencia aprobada da experiencia
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `024_sugerencias_con_puntos` de
-- db/01_esquema.sql. Si cambias uno, cambia el otro.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Una columna, dos triggers.
--
-- POR QUÉ HACÍA FALTA
--
-- `contribution_points('suggestion')` vale 3 desde 06_reconocimiento, pero nada la
-- otorgaba. Y no podía: `submissions.created_by` existía y nadie la llenaba. El formulario
-- público inserta con la clave anónima, así que toda sugerencia llegaba sin autor, «lo que
-- enviaste» en Mi cuenta salía siempre vacío y no había a quién darle los puntos.
--
-- QUÉ AÑADE
--
-- 1. El autor lo pone la BASE: `created_by := auth.uid()` al insertar, pisando lo que
--    venga. Sin esto, cualquiera con la clave anónima podría firmar una sugerencia con el
--    `user_id` de otra persona (la tabla de posiciones los publica). Sin sesión queda en
--    null, que sigue siendo un camino de primera clase: en una emergencia no se exige
--    cuenta para avisar de un refugio.
--
-- 2. `submissions.location_id`: el punto que se publicó a partir de la sugerencia. El
--    panel lo manda al aprobar desde el formulario. Sirve para que dos sugerencias de la
--    misma persona aprobadas el mismo día cuenten las dos (el índice de una-vez-al-día de
--    `contributions` distingue por punto).
--
-- 3. `reward_approved_submission`: al PASAR a «approved», 3 puntos a quien la mandó.
--    Mismo patrón que `reward_applied_report`: cuelga del hecho y no de la pantalla, y el
--    valor sale de `contribution_points`. Quien la aprueba no se premia a sí mismo: si el
--    autor es el mismo miembro del equipo que la revisa, no suma.
--
-- MIENTRAS NO SE CORRA, la app funciona igual: las sugerencias se siguen enviando sin
-- autor y no dan puntos.
-- ===========================================================================

alter table public.submissions
  add column if not exists location_id text references public.locations(id) on delete set null;

-- ── 1. El autor lo decide la sesión, no el cuerpo de la petición ──────────────

create or replace function private.stamp_submission_author()
returns trigger
language plpgsql
set search_path = public
as $stamp$
begin
  new.created_by := auth.uid();
  -- El punto publicado lo fija el equipo al aprobar, nunca quien sugiere.
  new.location_id := null;
  return new;
end
$stamp$;

drop trigger if exists trg_submissions_author on public.submissions;
create trigger trg_submissions_author before insert on public.submissions
  for each row execute function private.stamp_submission_author();

-- ── 2. Los puntos, al aprobarse ───────────────────────────────────────────

create or replace function public.reward_approved_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $reward$
begin
  if new.status = 'approved'
     and old.status is distinct from 'approved'
     and new.created_by is not null
     -- Nadie se aprueba a sí mismo los puntos.
     and new.created_by is distinct from auth.uid()
  then
    insert into public.contributions (user_id, kind, location_id, points, emergency_id)
    values (
      new.created_by, 'suggestion', new.location_id,
      public.contribution_points('suggestion'), new.emergency_id
    )
    on conflict do nothing;
  end if;
  return new;
end
$reward$;

revoke all on function public.reward_approved_submission() from public, anon, authenticated;

drop trigger if exists trg_submissions_reward on public.submissions;
create trigger trg_submissions_reward after update on public.submissions
  for each row execute function public.reward_approved_submission();

notify pgrst, 'reload schema';
