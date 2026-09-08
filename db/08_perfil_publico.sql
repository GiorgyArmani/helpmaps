-- ===========================================================================
-- 08 · El perfil público de un punto: portada y foto
--
-- CÓMO SE CORRE: entero, de una vez, en el editor SQL de Supabase. Es idempotente —se
-- puede repetir sin daño— y toca dos cosas: dos columnas en `center_info` y tres políticas
-- en `storage.objects`.
--
-- ⚠️ El bucket `initiatives` YA ESTÁ CREADO (por API, el 2026-09-08): público en lectura,
-- 3 MB por archivo, sólo JPG/PNG/WEBP. Este archivo NO lo crea. Si algún día hay que
-- rehacerlo en otro país, se crea desde el panel de Storage con esos mismos límites.
--
-- ── QUÉ RESUELVE ───────────────────────────────────────────────────────────
--
-- `/c/<id>` era una tarjeta: nombre, qué necesita y un enlace al mapa. Una iniciativa que
-- entra al mapa no tenía NINGÚN sitio propio que enseñar a un aliado, a un donante o a su
-- comunidad — que es, literalmente, la parte del plan de negocio que nos devolvieron
-- corregida: visibilidad y trazabilidad.
--
-- Esto añade lo único que faltaba en la base para que esa página sea un perfil: una imagen
-- de portada y una foto. Lo demás —campañas, agenda, publicaciones, datos de aporte— ya
-- existe desde `05_iniciativas.sql`.
--
-- ── POR QUÉ SÓLO GUARDAMOS LA URL ──────────────────────────────────────────
--
-- El archivo vive en Storage y aquí queda su dirección. Guardar el binario en la tabla
-- haría que la consulta del mapa —que trae cientos de fichas de una vez— arrastrase
-- megabytes que nadie va a mirar.
--
-- ⚠️ Las imágenes son PÚBLICAS a propósito: se ponen para que las vea cualquiera, incluido
-- quien llega sin cuenta desde un enlace compartido. Lo que no es público es ESCRIBIR, y de
-- eso se ocupan las políticas de más abajo.
-- ===========================================================================

-- Que falle rápido en vez de quedarse colgada.
--
-- Correr una migración con la aplicación abierta ya dio un deadlock una vez: `alter table`
-- pide un lock exclusivo sobre `center_info` mientras las consultas normales la están
-- leyendo, y las dos se quedan esperándose. Con esto, si no puede tomar el lock en cinco
-- segundos, aborta con un mensaje claro y se vuelve a intentar; sin esto, espera indefinido
-- y hay que adivinar qué pasó.
set lock_timeout = '5s';


-- ---------------------------------------------------------------------------
-- 1) Las dos columnas
--
-- Nulables y sin valor por defecto: añadirlas es un cambio de metadatos, instantáneo, y no
-- reescribe las 476 filas que ya hay. `if not exists` para que repetir el archivo no falle.
-- ---------------------------------------------------------------------------

alter table public.center_info add column if not exists banner_url text;
alter table public.center_info add column if not exists photo_url text;


-- ---------------------------------------------------------------------------
-- 2) Quién puede subir una imagen
--
-- La ruta del archivo es `<location_id>/<tipo>-<sello>.<ext>`, y el permiso se decide
-- leyendo el PRIMER TRAMO de esa ruta. Es la frontera de siempre, `manages_location`: quien
-- gestiona un punto escribe en la carpeta de su punto y en ninguna otra.
--
-- Va sobre la ruta y no sobre una columna de metadatos porque la ruta es lo único que el
-- cliente no puede falsear sin que la política lo vea: quien intente subir a la carpeta de
-- otro punto se estrella contra lo que diga `center_managers`.
--
-- El equipo no aparece aquí, y no es un olvido: la portada de un comedor la elige el
-- comedor. Si hiciera falta retirar una imagen inapropiada se hace con la clave de
-- servicio, que deja rastro, y no con un permiso permanente que nadie recuerda que existe.
--
-- No hace falta política de LECTURA: el bucket es público, así que leer no pasa por RLS.
-- ---------------------------------------------------------------------------

drop policy if exists initiatives_manager_insert on storage.objects;
create policy initiatives_manager_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'initiatives'
    and public.manages_location(split_part(name, '/', 1))
  );

-- Reemplazar la portada es lo normal, no la excepción: se cambia cada temporada.
drop policy if exists initiatives_manager_update on storage.objects;
create policy initiatives_manager_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'initiatives'
    and public.manages_location(split_part(name, '/', 1))
  )
  with check (
    bucket_id = 'initiatives'
    and public.manages_location(split_part(name, '/', 1))
  );

drop policy if exists initiatives_manager_delete on storage.objects;
create policy initiatives_manager_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'initiatives'
    and public.manages_location(split_part(name, '/', 1))
  );


-- ---------------------------------------------------------------------------
-- 3) Comprobación
--
-- Devuelve una tabla de cinco filas. Las cinco tienen que decir `ok`. Si alguna dice
-- `FALTA`, esa parte no se aplicó y el resto del archivo se puede volver a correr.
-- ---------------------------------------------------------------------------

select
  'columna banner_url' as que,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'center_info' and column_name = 'banner_url'
  ) then 'ok' else 'FALTA' end as estado
union all
select
  'columna photo_url',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'center_info' and column_name = 'photo_url'
  ) then 'ok' else 'FALTA' end
union all
select
  'politica insert',
  case when exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'initiatives_manager_insert'
  ) then 'ok' else 'FALTA' end
union all
select
  'politica update',
  case when exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'initiatives_manager_update'
  ) then 'ok' else 'FALTA' end
union all
select
  'politica delete',
  case when exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'initiatives_manager_delete'
  ) then 'ok' else 'FALTA' end;


-- ---------------------------------------------------------------------------
-- Lo que se comprueba después, desde la aplicación
--
--   Con la sesión de un gestor: subir a `<su punto>/banner.jpg` entra;
--   subir a `<otro punto>/banner.jpg` devuelve 403.
--   Sin sesión: subir devuelve 403, y LEER una imagen ya subida funciona.
-- ---------------------------------------------------------------------------
