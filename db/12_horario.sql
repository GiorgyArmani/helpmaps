-- ===========================================================================
-- db/12_horario.sql — el horario de atención como dato
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `018_horario` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Es una columna y una restricción: no toca
-- políticas ni bloquea más de un instante, así que se puede correr con la app abierta.
--
-- QUÉ AÑADE
--
-- `center_info.hours`, el horario marcado día por día:
--
--   { "tz": "America/Caracas",
--     "days": { "mon": [["08:00","17:00"]], "sat": [["09:00","13:00"]] } }
--
-- `schedule` (texto) NO se toca ni se borra: los 476 horarios escritos a mano siguen
-- viéndose tal cual, y la app escribe también ahí el resumen en texto de lo marcado, para
-- la API pública y para cualquier cliente que no conozca la columna nueva.
--
-- Sin políticas nuevas: las de `center_info` son por fila, y quien podía escribir el
-- horario en texto puede escribir éste.
--
-- MIENTRAS NO SE CORRA, la app funciona igual: lee sin la columna y guarda sólo el texto.
-- ===========================================================================

alter table public.center_info
  add column if not exists hours jsonb;

-- Sólo la forma de fuera. El detalle (días, "HH:MM") lo valida la app al leer y descarta lo
-- que no encaja: una restricción minuciosa aquí convertiría un turno mal escrito en un
-- guardado que falla entero, que es peor que un turno ignorado.
alter table public.center_info drop constraint if exists center_info_hours_shape;
alter table public.center_info add constraint center_info_hours_shape
  check (
    hours is null
    or (jsonb_typeof(hours) = 'object' and jsonb_typeof(hours -> 'days') = 'object')
  );

comment on column public.center_info.hours is
  'Horario marcado: {"tz": zona IANA, "days": {"mon".."sun": [["HH:MM","HH:MM"], ...]}}. '
  'Un fin menor que el inicio cruza la medianoche; "24:00" es hasta medianoche.';

notify pgrst, 'reload schema';
