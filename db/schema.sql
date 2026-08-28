-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
--
-- ⚠️ Y aunque lo arreglaras, NO levanta un despliegue. Esto son las 15 tablas y nada más:
-- cero políticas, cero `enable row level security`, cero funciones, cero triggers, cero
-- índices. En este proyecto el navegador habla con Supabase directamente con la anon key,
-- que es pública por diseño, así que RLS no es una capa más — es TODA la defensa. Una base
-- creada desde aquí deja `submissions`, `volunteer_requests`, `audit_log`, `staff_users`,
-- `profiles` y `favourites` legibles y escribibles por cualquiera.
--
-- Para crear una base: db/01_esquema.sql → db/02_emergencia.sql → db/03_verificacion.sql.
-- Esto sirve para OTRA cosa: leer de un vistazo qué columnas hay, sin cruzar 1717 líneas.

CREATE TABLE public.locations (
  id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['shelter'::text, 'donation_centre'::text, 'comedor'::text, 'iniciativa'::text, 'hospital'::text, 'morgue'::text])),
  region text,
  municipality text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  address text,
  phone text,
  whatsapp text,
  aliases ARRAY NOT NULL DEFAULT '{}'::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  emergency_id uuid,
  country_code text,
  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_emergency_id_fkey FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id)
);
CREATE TABLE public.center_info (
  location_id text NOT NULL,
  status text CHECK (status = ANY (ARRAY['abierto'::text, 'lleno'::text, 'cerrado'::text])),
  receives ARRAY NOT NULL DEFAULT '{}'::text[],
  needs text,
  help ARRAY NOT NULL DEFAULT '{}'::text[] CHECK (help <@ ARRAY['voluntariado'::text, 'especie'::text, 'oficios'::text, 'difusion'::text, 'economico'::text]),
  category text,
  description text,
  schedule text,
  contact_name text,
  social_url text,
  is_animal boolean NOT NULL DEFAULT false,
  last_confirmed_at timestamp with time zone,
  source text,
  external_id text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT center_info_pkey PRIMARY KEY (location_id),
  CONSTRAINT center_info_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.app_settings (
  id boolean NOT NULL DEFAULT true CHECK (id),
  maintenance boolean NOT NULL DEFAULT false,
  notice text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.staff_users (
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'volunteer'::text])),
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_users_pkey PRIMARY KEY (user_id),
  CONSTRAINT staff_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'center'::text CHECK (kind = ANY (ARRAY['center'::text, 'initiative'::text, 'need'::text, 'other'::text])),
  message text NOT NULL,
  name text,
  contact text,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  emergency_id uuid,
  created_by uuid,
  CONSTRAINT submissions_pkey PRIMARY KEY (id),
  CONSTRAINT submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id),
  CONSTRAINT submissions_emergency_id_fkey FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id),
  CONSTRAINT submissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.volunteer_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  profile text,
  motivation text,
  region text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  emergency_id uuid,
  user_id uuid,
  CONSTRAINT volunteer_requests_pkey PRIMARY KEY (id),
  CONSTRAINT volunteer_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id),
  CONSTRAINT volunteer_requests_emergency_id_fkey FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id),
  CONSTRAINT volunteer_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.audit_log (
  id bigint NOT NULL DEFAULT nextval('audit_log_id_seq'::regclass),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  summary text,
  actor_id uuid,
  actor_email text,
  actor_role text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  emergency_id uuid,
  CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.donations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  social_url text,
  donate_url text,
  donate_info text,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  emergency_id uuid,
  CONSTRAINT donations_pkey PRIMARY KEY (id),
  CONSTRAINT donations_emergency_id_fkey FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id)
);
CREATE TABLE public.emergencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  host text UNIQUE,
  country_code text NOT NULL,
  country_name text NOT NULL,
  name text NOT NULL,
  hazard_type text NOT NULL DEFAULT 'earthquake'::text CHECK (hazard_type = ANY (ARRAY['earthquake'::text, 'flood'::text, 'storm'::text, 'fire'::text, 'landslide'::text, 'conflict'::text, 'other'::text])),
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])),
  region_noun jsonb NOT NULL DEFAULT '{"one": "región", "many": "regiones"}'::jsonb,
  geo jsonb NOT NULL,
  regions jsonb NOT NULL DEFAULT '[]'::jsonb,
  legal jsonb NOT NULL,
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  language jsonb NOT NULL DEFAULT '{}'::jsonb,
  hazard jsonb NOT NULL DEFAULT '{}'::jsonb,
  layers jsonb NOT NULL DEFAULT '[]'::jsonb,
  maintenance boolean NOT NULL DEFAULT false,
  notice text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  news jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT emergencies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.staff_emergencies (
  user_id uuid NOT NULL,
  emergency_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_emergencies_pkey PRIMARY KEY (user_id, emergency_id),
  CONSTRAINT staff_emergencies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT staff_emergencies_emergency_id_fkey FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id)
);
CREATE TABLE public.emergency_phones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  emergency_id uuid,
  name text NOT NULL,
  number text NOT NULL,
  description text,
  region text,
  municipality text,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT emergency_phones_pkey PRIMARY KEY (id),
  CONSTRAINT emergency_phones_emergency_id_fkey FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id)
);
CREATE TABLE public.news_bulletins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  emergency_id uuid NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  summary text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_bulletins_pkey PRIMARY KEY (id),
  CONSTRAINT news_bulletins_emergency_id_fkey FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id)
);
CREATE TABLE public.profiles (
  user_id uuid NOT NULL,
  display_name text NOT NULL CHECK (length(TRIM(BOTH FROM display_name)) >= 2 AND length(TRIM(BOTH FROM display_name)) <= 40),
  region text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.favourites (
  user_id uuid NOT NULL,
  location_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT favourites_pkey PRIMARY KEY (user_id, location_id),
  CONSTRAINT favourites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT favourites_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.point_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_id text NOT NULL,
  emergency_id uuid,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['sigue_abierto'::text, 'ya_cerro'::text, 'dato_incorrecto'::text])),
  note text CHECK (note IS NULL OR length(note) <= 500),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'applied'::text, 'dismissed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  CONSTRAINT point_reports_pkey PRIMARY KEY (id),
  CONSTRAINT point_reports_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT point_reports_emergency_id_fkey FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id),
  CONSTRAINT point_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT point_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);