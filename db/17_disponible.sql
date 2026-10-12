-- ===========================================================================
-- db/17_disponible.sql — lo que un punto TIENE para entregar, con su fecha
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `021_disponible` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Son dos columnas, una restricción y un trigger:
-- no toca políticas ni bloquea más de un instante, así que se puede correr con la app
-- abierta.
--
-- QUÉ AÑADE
--
-- `center_info.offers`: lo que el punto entrega a quien lo necesita —agua, alimentos,
-- medicamentos—. Es la otra mitad de `receives`, y hasta ahora no existía: `receives` es lo
-- que el punto ACEPTA como donativo y `needs` lo que PIDE. Ninguno de los dos dice «aquí
-- hay esto para ti», y enseñar `receives` a quien busca ayuda lo manda a una puerta donde
-- quizá no hay nada.
--
-- Texto libre, igual que `receives` y por lo mismo: los chips de la app sólo ahorran
-- teclear, y una lista cerrada dejaría fuera justo lo que hay hoy y nadie previó.
--
-- `center_info.offers_confirmed_at`: cuándo dijo alguien, por última vez, que eso sigue
-- ahí. LA PONE LA BASE, no el cliente. Lo que hay en un estante cambia en horas, y esta
-- fecha es lo único que separa «hay agua» de «había agua»: la app la enseña al lado, avisa
-- de llamar antes a la semana y deja de mostrar la lista al mes. Si el navegador pudiera
-- escribirla, se podría publicar un «confirmado hoy» con fecha de mañana.
--
-- El trigger la sella cuando la lista cambia y cuando el cliente la toca (el botón «Sigue
-- disponible» manda la columna; el valor que mande da igual, se queda `now()`). Guardar
-- otra parte de la ficha NO la mueve: corregir el horario no confirma lo que hay en el
-- estante.
--
-- Sin políticas nuevas: las de `center_info` son por fila, y quien podía escribir lo que
-- el punto recibe puede escribir lo que entrega.
--
-- MIENTRAS NO SE CORRA, la app funciona igual: lee sin las columnas y no dibuja el bloque.
-- ===========================================================================

alter table public.center_info
  add column if not exists offers text[] not null default '{}',
  add column if not exists offers_confirmed_at timestamptz;

-- Sólo el tamaño. Es una lista de chips, no un inventario.
alter table public.center_info drop constraint if exists center_info_offers_size;
alter table public.center_info add constraint center_info_offers_size
  check (cardinality(offers) <= 40);

create or replace function public.stamp_offers_confirmed()
returns trigger
language plpgsql
set search_path = public
as $offers$
begin
  if cardinality(new.offers) = 0 then
    -- Sin nada que entregar no hay nada que confirmar.
    new.offers_confirmed_at := null;
  elsif tg_op = 'INSERT'
     or new.offers is distinct from old.offers
     or new.offers_confirmed_at is distinct from old.offers_confirmed_at then
    new.offers_confirmed_at := now();
  end if;
  return new;
end
$offers$;

drop trigger if exists trg_center_info_offers on public.center_info;
create trigger trg_center_info_offers
  before insert or update on public.center_info
  for each row execute function public.stamp_offers_confirmed();

comment on column public.center_info.offers is
  'Lo que el punto entrega a quien lo necesita. Texto libre. No confundir con `receives`, '
  'que es lo que acepta como donativo.';
comment on column public.center_info.offers_confirmed_at is
  'Última vez que alguien confirmó `offers`. La sella el trigger `trg_center_info_offers`; '
  'el valor que mande el cliente se ignora.';

notify pgrst, 'reload schema';
