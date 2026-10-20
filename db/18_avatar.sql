-- ===========================================================================
-- db/18_avatar.sql — el avatar: un animal de la fauna del país, vestido por su dueño
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `022_avatar` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Es una columna, una restricción y un trigger:
-- no toca políticas ni bloquea más de un instante, así que se puede correr con la app
-- abierta.
--
-- QUÉ AÑADE
--
-- `profiles.avatar`: el avatar de la persona, como identificadores de catálogo
-- (`{"sp":"chiguire","hab":"llanos","ropa":{"id":"playera","c":"verde"},...}`). Nada de
-- texto libre ni de dibujo: el catálogo y el arte viven en el código
-- (`src/domain/avatar.ts`, `src/features/avatar/art.ts`).
--
-- SÓLO LO ESCRIBE EL SERVIDOR. Algunas piezas se ganan con el nivel (el chaleco de
-- voluntario, el brazalete de brigada…), y el nivel sale de `contributions`, que nadie
-- puede escribir desde el navegador. Si el navegador pudiera escribir esta columna
-- directamente —la política de `profiles` deja a cada uno editar SU fila—, bastaría con
-- mandarse el chaleco por la API. El trigger lo impide: un cambio de `avatar` que no venga
-- con el rol de servicio se rechaza. Las rutas `/api/account/register` y
-- `/api/account/avatar` validan contra el catálogo y el nivel real, y escriben con ese rol.
--
-- Sin políticas nuevas: quien ya podía leer una fila de `profiles` (su dueño, y la
-- organización de un evento al que la persona se anotó) lee también su avatar, que es lo
-- que se espera ver junto a un nombre.
--
-- MIENTRAS NO SE CORRA, la app funciona igual: el registro guarda el avatar sólo en la
-- sesión (la barra lo dibuja), la cuenta lo lee de ahí, y el perfil se crea sin él.
-- ===========================================================================

alter table public.profiles
  add column if not exists avatar jsonb;

-- Un objeto, y pequeño: son seis identificadores, no un dibujo.
alter table public.profiles drop constraint if exists profiles_avatar_shape;
alter table public.profiles add constraint profiles_avatar_shape
  check (avatar is null or (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) <= 1024));

create or replace function public.guard_profile_avatar()
returns trigger
language plpgsql
set search_path = public
as $avatar$
begin
  if (tg_op = 'INSERT' and new.avatar is not null)
     or (tg_op = 'UPDATE' and new.avatar is distinct from old.avatar) then
    -- El rol de servicio (las rutas del servidor) y quien corre SQL a mano en el editor.
    if coalesce(auth.role(), '') <> 'service_role'
       and current_user not in ('postgres', 'supabase_admin', 'service_role') then
      raise exception 'avatar_server_only'
        using errcode = '42501',
              hint = 'El avatar se guarda por /api/account/avatar, que comprueba el nivel.';
    end if;
  end if;
  return new;
end
$avatar$;

drop trigger if exists trg_profiles_avatar_guard on public.profiles;
create trigger trg_profiles_avatar_guard
  before insert or update on public.profiles
  for each row execute function public.guard_profile_avatar();

comment on column public.profiles.avatar is
  'El avatar: especie, hábitat y una pieza por zona, como ids del catálogo de '
  'src/domain/avatar.ts. Sólo lo escribe el servidor (trigger trg_profiles_avatar_guard).';

notify pgrst, 'reload schema';
