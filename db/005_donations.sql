-- HelpMaps · directorio de donaciones (5 de 5) — corre esto DESPUÉS de 004_audit_log.sql.
--
-- La vía económica, que el mapa por sí solo no cubre: organizaciones e iniciativas a las
-- que alguien puede aportar dinero o especie, con los datos para hacerlo (transferencia,
-- pago móvil, enlace de donación) y su red social para verificarlas.
--
-- Va en su propia tabla y NO en `locations` a propósito: una organización que recibe
-- aportes no es un lugar al que se va, y ponerla en el mapa mandaría gente a la puerta de
-- una oficina en vez de a un punto de ayuda.
--
-- Mismo modelo de acceso que los puntos: lee cualquiera, escribe el equipo, borra solo un
-- admin. Sin semillas: qué organizaciones aparecen es una decisión de cada país y
-- publicar una lista de otro país sería peor que no publicar ninguna.
--
-- Idempotente.

create table if not exists public.donations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- Una línea. Qué hace, no su historia.
  description text,
  -- Red social o web: es lo que permite a quien va a donar comprobar que existe.
  social_url  text,
  -- Enlace de donación → el botón "Donar".
  donate_url  text,
  -- Datos para recibir aportes en texto libre (cuenta, pago móvil, Zelle…). Texto y no
  -- columnas porque cambia por país y por organización, y se muestra con un botón de
  -- copiar: quien dona lo pega tal cual en su banco.
  donate_info text,
  sort        int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists donations_active_idx on public.donations (sort, name) where active;

alter table public.donations enable row level security;

-- Lectura pública: solo las activas. Desactivar es la forma de retirar una organización
-- sin perder su historia.
drop policy if exists donations_public_read on public.donations;
create policy donations_public_read on public.donations
  for select to anon, authenticated using (active);

-- El equipo ve todas, incluidas las desactivadas, para poder reactivarlas.
drop policy if exists donations_staff_read on public.donations;
create policy donations_staff_read on public.donations
  for select to authenticated using (public.is_staff());

drop policy if exists donations_staff_insert on public.donations;
create policy donations_staff_insert on public.donations
  for insert to authenticated with check (public.is_staff());

drop policy if exists donations_staff_update on public.donations;
create policy donations_staff_update on public.donations
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- Borrar sigue siendo de admin, como en el mapa.
drop policy if exists donations_admin_delete on public.donations;
create policy donations_admin_delete on public.donations
  for delete to authenticated using (public.is_admin());

-- Bitácora: publicar a nombre de quién se reciben donaciones es exactamente el tipo de
-- cambio que hay que poder auditar después. `audit_row()` viene de 004.
-- ⚠️ Si ya corriste 004 antes de que existiera este archivo, vuelve a correrlo: allí se
-- añadió el nombre de la organización al resumen que se ve en «Novedades». Es idempotente.
drop trigger if exists trg_audit_donations on public.donations;
create trigger trg_audit_donations after insert or update or delete on public.donations
  for each row execute function public.audit_row();
