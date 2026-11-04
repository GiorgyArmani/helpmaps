-- ===========================================================================
-- db/24_seguidores_avatar.sql — los avatares de quienes siguen a una organización
-- ---------------------------------------------------------------------------
-- Idempotente. Copia literal de la sección `027_seguidores_avatar` de db/01_esquema.sql.
-- Si cambias uno, cambia el otro. Necesita db/18_avatar.sql y db/19_seguir_y_verificada.sql.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Una función, sin tablas nuevas.
--
-- POR QUÉ
--
-- El perfil de una organización enseña cuántos la siguen. Un número solo no dice que hay
-- gente detrás; los animalitos de quienes la siguen, uno al lado del otro, sí, y cada
-- persona nueva suma el suyo.
--
-- QUIÉN sigue a quién sigue siendo privado (`center_follows` lo lee sólo su dueño). Esto
-- devuelve ÚNICAMENTE el dibujo —especie, hábitat, ropa, como ids del catálogo—: ni el
-- nombre, ni el id, ni cuándo. El orden es el más reciente primero, pero la fecha no sale.
--
-- MIENTRAS NO SE CORRA, la app funciona igual: el perfil enseña sólo el número.
-- ===========================================================================

create or replace function public.follower_avatars(p_location text, p_limit integer default 5)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fa$
  select coalesce(jsonb_agg(a.avatar), '[]'::jsonb)
  from (
    select p.avatar
    from public.center_follows f
    join public.profiles p on p.user_id = f.user_id
    where f.location_id = p_location
      and p.avatar is not null
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 5), 1), 8)
  ) a;
$fa$;

revoke all on function public.follower_avatars(text, integer) from public;
grant execute on function public.follower_avatars(text, integer) to anon, authenticated;

notify pgrst, 'reload schema';
