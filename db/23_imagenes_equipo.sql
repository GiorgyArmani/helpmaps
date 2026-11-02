-- ===========================================================================
-- db/23_imagenes_equipo.sql — el equipo también sube portadas y fotos
-- ---------------------------------------------------------------------------
-- Idempotente. Como db/08, vive sólo aquí: las políticas de Storage no están en
-- db/01_esquema.sql.
--
-- CÓMO SE CORRE: entero, en el editor SQL. Rehace las tres políticas de escritura del
-- bucket `initiatives` que puso db/08_perfil_publico.sql.
--
-- POR QUÉ
--
-- Las tablas de un perfil (`center_info`, campañas, eventos, publicaciones) las escribe
-- quien gestiona el punto Y el equipo: `private.can_manage_location`. El bucket de sus
-- imágenes se quedó con la mitad, `private.manages_location`, que sólo mira
-- `center_managers`. Resultado: el equipo podía editar cualquier perfil menos su portada
-- y su foto, y el perfil de HelpMaps —que no tiene gestores, lo lleva el equipo— no podía
-- tener imagen. La subida respondía 400 y el formulario decía «revisa el formato».
--
-- Ahora el bucket pide lo mismo que las tablas. No abre nada a quien no podía ya editar
-- ese perfil.
-- ===========================================================================

drop policy if exists initiatives_manager_insert on storage.objects;
create policy initiatives_manager_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'initiatives'
    and private.can_manage_location(split_part(name, '/', 1))
  );

drop policy if exists initiatives_manager_update on storage.objects;
create policy initiatives_manager_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'initiatives'
    and private.can_manage_location(split_part(name, '/', 1))
  )
  with check (
    bucket_id = 'initiatives'
    and private.can_manage_location(split_part(name, '/', 1))
  );

drop policy if exists initiatives_manager_delete on storage.objects;
create policy initiatives_manager_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'initiatives'
    and private.can_manage_location(split_part(name, '/', 1))
  );

-- ---------------------------------------------------------------------------
-- Verificación
--
--   select policyname, with_check from pg_policies
--    where schemaname = 'storage' and policyname like 'initiatives_manager_%';
--   -- las tres deben decir can_manage_location.
-- ---------------------------------------------------------------------------
